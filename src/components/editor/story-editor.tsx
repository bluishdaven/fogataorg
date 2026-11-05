"use client";

import type { Editor } from "@tiptap/core";
import UniqueID from "@tiptap/extension-unique-id";
import { CharacterCount, Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ArrowLeft,
  Camera,
  Code2,
  Heading2,
  Heading3,
  ImagePlus,
  Lightbulb,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  TextQuote,
  Upload,
} from "lucide-react";
import NextLink from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { toast } from "sonner";
import { discardPendingChanges } from "@/app/actions/stories";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Toaster } from "@/components/ui/sonner";
import { UnsplashPicker } from "@/components/unsplash/unsplash-picker";
import { Link } from "@/i18n/navigation";
import type { TiptapDoc } from "@/lib/domain/content";
import { storyPath } from "@/lib/domain/handle-routes";
import { storyState, type StoryState } from "@/lib/domain/stories";
import { creditFromPhoto, type UnsplashPhoto } from "@/lib/domain/unsplash";
import { Callout, Figure, PullQuote } from "./nodes";
import { PublishDialog, type PublishDialogStory, type TopicOption } from "./publish-dialog";
import { SelectionToolbar } from "./selection-toolbar";
import { SlashCommand, type SlashItem } from "./slash-command";
import { ACCEPTED_IMAGE_TYPES, UploadError, uploadStoryImage } from "./upload";
import { readBackup, useAutosave, type SaveStatus } from "./use-autosave";

const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "blockquote",
  "pullQuote",
  "callout",
  "bulletList",
  "orderedList",
  "listItem",
  "codeBlock",
  "horizontalRule",
  "figure",
];

export type EditorStoryProps = PublishDialogStory & {
  id: string;
  revision: number;
  content: TiptapDoc;
  hasPendingChanges: boolean;
  updatedAt: Date;
};

function imageFiles(data: DataTransfer | null): File[] {
  return Array.from(data?.files ?? []).filter((file) => file.type.startsWith("image/"));
}

export function StoryEditor({
  story,
  userId,
  username,
  topics,
}: {
  story: EditorStoryProps;
  userId: string;
  username: string;
  topics: TopicOption[];
}) {
  const t = useTranslations("Editor");
  const locale = useLocale();
  const router = useRouter();
  const [title, setTitle] = useState(story.title);
  const [subtitle, setSubtitle] = useState(story.subtitle);
  const [uploads, setUploads] = useState(0);
  const [unsplashOpen, setUnsplashOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const titleRef = useRef(story.title);
  const subtitleRef = useRef(story.subtitle);
  const editorRef = useRef<Editor | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const subtitleInput = useRef<HTMLTextAreaElement>(null);

  const getSnapshot = useCallback(
    () => ({
      title: titleRef.current,
      subtitle: subtitleRef.current,
      // ProseMirror attrs are prototype-less objects, which server actions refuse to
      // serialize; a JSON round-trip turns the document into plain data.
      content: editorRef.current ? (JSON.parse(JSON.stringify(editorRef.current.getJSON())) as unknown) : story.content,
    }),
    [story.content],
  );
  const autosave = useAutosave({ storyId: story.id, initialRevision: story.revision, getSnapshot });
  const markChangedRef = useRef(autosave.markChanged);
  useEffect(() => {
    markChangedRef.current = autosave.markChanged;
  }, [autosave.markChanged]);

  /** Brings back edits saved on this device that never reached the server. */
  function restoreLocalBackup(created: Editor) {
    const backup = readBackup(story.id);
    if (!backup || backup.revision !== story.revision) return;
    const differs =
      backup.title !== story.title ||
      backup.subtitle !== story.subtitle ||
      JSON.stringify(backup.content) !== JSON.stringify(story.content);
    if (!differs) return;
    titleRef.current = backup.title;
    subtitleRef.current = backup.subtitle;
    setTitle(backup.title);
    setSubtitle(backup.subtitle);
    created.commands.setContent(backup.content as TiptapDoc, { emitUpdate: false });
    markChangedRef.current();
    toast(t("restored"));
  }

  const uploadFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        setUploads((n) => n + 1);
        try {
          const image = await uploadStoryImage(file, userId);
          editorRef.current?.chain().focus().insertFigure({ src: image.url, width: image.width, height: image.height }).run();
          toast(t("altReminder"));
        } catch (error) {
          toast.error(t(`uploadErrors.${error instanceof UploadError ? error.reason : "failed"}`));
        } finally {
          setUploads((n) => n - 1);
        }
      }
    },
    [t, userId],
  );

  const slashItems = useMemo<SlashItem[]>(
    () => [
      { id: "text", icon: Pilcrow, title: t("slash.text"), description: t("slash.textHint"), keywords: ["p", "paragraph", "parrafo", "texto"], run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
      { id: "h2", icon: Heading2, title: t("slash.heading"), description: t("slash.headingHint"), keywords: ["h2", "title", "titulo", "encabezado"], run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run() },
      { id: "h3", icon: Heading3, title: t("slash.subheading"), description: t("slash.subheadingHint"), keywords: ["h3", "subtitle", "subtitulo"], run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run() },
      { id: "quote", icon: Quote, title: t("slash.quote"), description: t("slash.quoteHint"), keywords: ["blockquote", "cita"], run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
      { id: "pullquote", icon: TextQuote, title: t("slash.pullQuote"), description: t("slash.pullQuoteHint"), keywords: ["pull", "destacada", "frase"], run: (e, r) => e.chain().focus().deleteRange(r).setPullQuote().run() },
      { id: "callout", icon: Lightbulb, title: t("slash.callout"), description: t("slash.calloutHint"), keywords: ["note", "nota", "aviso"], run: (e, r) => e.chain().focus().deleteRange(r).setCallout().run() },
      { id: "bullets", icon: List, title: t("slash.bullets"), description: t("slash.bulletsHint"), keywords: ["ul", "list", "lista", "vinetas"], run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
      { id: "numbers", icon: ListOrdered, title: t("slash.numbers"), description: t("slash.numbersHint"), keywords: ["ol", "numbered", "numerada"], run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
      { id: "code", icon: Code2, title: t("slash.code"), description: t("slash.codeHint"), keywords: ["code", "codigo", "snippet"], run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
      { id: "divider", icon: Minus, title: t("slash.divider"), description: t("slash.dividerHint"), keywords: ["hr", "separator", "separador", "linea"], run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
      { id: "image", icon: ImagePlus, title: t("slash.image"), description: t("slash.imageHint"), keywords: ["img", "photo", "foto", "imagen", "upload", "subir"], run: (e, r) => { e.chain().focus().deleteRange(r).run(); fileInput.current?.click(); } },
      { id: "unsplash", icon: Camera, title: t("slash.unsplash"), description: t("slash.unsplashHint"), keywords: ["unsplash", "photo", "foto", "stock"], run: (e, r) => { e.chain().focus().deleteRange(r).run(); setUnsplashOpen(true); } },
    ],
    [t],
  );

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          autolink: true,
          defaultProtocol: "https",
          protocols: ["http", "https", "mailto"],
          HTMLAttributes: { rel: "noopener noreferrer nofollow", target: null },
        },
        dropcursor: { color: "var(--ember)", width: 2 },
      }),
      Placeholder.configure({
        placeholder: ({ node }) => (node.type.name === "heading" ? t("headingPlaceholder") : t("bodyPlaceholder")),
      }),
      CharacterCount,
      UniqueID.configure({ types: BLOCK_TYPES }),
      Figure,
      Callout,
      PullQuote,
      // Items only depend on the locale's translations, which don't change while editing.
      SlashCommand.configure({ getItems: () => slashItems, emptyLabel: t("slashEmpty") }),
    ],
    content: story.content,
    editorProps: {
      attributes: {
        class: "prose-fogata editor-body mx-auto min-h-[45vh] outline-none",
        "aria-label": t("bodyLabel"),
        "data-testid": "editor-body",
      },
      handlePaste: (_view, event) => {
        const files = imageFiles(event.clipboardData);
        if (!files.length) return false;
        void uploadFiles(files);
        return true;
      },
      handleDrop: (_view, event, _slice, moved) => {
        if (moved) return false;
        const files = imageFiles((event as DragEvent).dataTransfer);
        if (!files.length) return false;
        event.preventDefault();
        void uploadFiles(files);
        return true;
      },
    },
    onCreate: ({ editor: created }) => {
      editorRef.current = created;
      restoreLocalBackup(created);
    },
    onUpdate: () => markChangedRef.current(),
  });

  const words = useEditorState({ editor, selector: ({ editor: e }) => e?.storage.characterCount.words() ?? 0 }) ?? 0;


  const onTitleChange = (value: string) => {
    const clean = value.replace(/\n/g, " ").slice(0, 200);
    titleRef.current = clean;
    setTitle(clean);
    autosave.markChanged();
  };
  const onSubtitleChange = (value: string) => {
    const clean = value.replace(/\n/g, " ").slice(0, 280);
    subtitleRef.current = clean;
    setSubtitle(clean);
    autosave.markChanged();
  };
  const onTitleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      subtitleInput.current?.focus();
    }
  };
  const onSubtitleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && editor) {
      event.preventDefault();
      // Focus synchronously (Tiptap's focus command waits a frame, so fast typing would land here).
      editor.view.focus();
      editor.commands.setTextSelection(1);
    }
  };

  const onPickUnsplash = (photo: UnsplashPhoto) => {
    editor
      ?.chain()
      .focus()
      .insertFigure({ src: photo.rawUrl, alt: photo.alt, width: photo.width, height: photo.height, credit: creditFromPhoto(photo) })
      .run();
  };

  const openPublish = async () => {
    await autosave.flush();
    setPublishOpen(true);
  };

  const discard = async () => {
    if (!window.confirm(t("discardConfirm"))) return;
    const result = await discardPendingChanges(story.id);
    if (result.ok) {
      window.localStorage.removeItem(`fogata:draft:${story.id}`);
      window.location.reload();
    }
  };

  const state: StoryState = storyState(story, new Date());
  const live = state === "published" || state === "unlisted";

  return (
    <div className="pb-24">
      {/* The title is a text field, so the page needs its own heading for screen-reader navigation. */}
      <h1 className="sr-only">{t("pageTitle")}</h1>
      <Toaster position="bottom-center" />
      <div className="sticky top-14 z-30 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between gap-3 px-4 text-sm">
          <Link
            href="/me/stories"
            className="flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full text-muted-foreground hover:text-foreground sm:min-h-0 sm:min-w-0 sm:justify-start"
          >
            <ArrowLeft className="size-4" aria-hidden />
            {/* Hidden visually on phones only: display:none would leave the link without a name. */}
            <span className="sr-only sm:not-sr-only">{t("backToStories")}</span>
          </Link>
          <p className="flex-1 truncate text-center text-muted-foreground" role="status" aria-live="polite" data-testid="save-status" data-status={autosave.status}>
            {uploads > 0 ? t("uploading") : <SaveLabel status={autosave.status} savedAt={autosave.savedAt} />}
          </p>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-muted-foreground sm:inline">{t("words", { count: words })}</span>
            {/* Typing "/" is awkward on a phone keyboard, so photos also have a button. */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon-sm" aria-label={t("addPhoto")} title={t("addPhoto")} disabled={!editor} data-testid="add-photo">
                  <ImagePlus className="size-5 sm:size-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-64">
                <DropdownMenuLabel>{t("addPhoto")}</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => fileInput.current?.click()} data-testid="add-photo-upload">
                  <Upload aria-hidden />
                  {t("addPhotoUpload")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setUnsplashOpen(true)} data-testid="add-photo-unsplash">
                  <Camera aria-hidden />
                  {t("addPhotoUnsplash")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {live ? (
              <NextLink href={storyPath(username, story.slug)} className="hidden text-muted-foreground hover:text-foreground sm:inline">
                {t("viewLive")}
              </NextLink>
            ) : null}
            <Button size="sm" onClick={() => void openPublish()} data-testid="open-publish">
              {state === "draft" ? t("publish") : t("update")}
            </Button>
          </div>
        </div>
      </div>

      {autosave.status === "conflict" ? (
        <div role="alert" className="mx-auto mt-4 flex max-w-[var(--measure)] items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span>{t("conflict")}</span>
          <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
            {t("reload")}
          </Button>
        </div>
      ) : null}

      {story.status !== "draft" ? (
        <div className="mx-auto mt-4 flex max-w-[var(--measure)] flex-wrap items-center justify-between gap-2 rounded-lg bg-secondary px-4 py-3 text-sm text-secondary-foreground">
          <span>{state === "scheduled" ? t("editingScheduled") : t("editingLive")}</span>
          {story.hasPendingChanges ? (
            <Button size="sm" variant="ghost" onClick={() => void discard()}>
              {t("discardChanges")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="mx-auto mt-10 flex max-w-[var(--measure)] flex-col gap-2 px-4 sm:px-0">
        <textarea
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          onKeyDown={onTitleKeyDown}
          placeholder={t("titlePlaceholder")}
          aria-label={t("titleLabel")}
          rows={1}
          maxLength={200}
          className="field-sizing-content resize-none overflow-hidden bg-transparent font-serif text-4xl leading-tight font-semibold outline-none placeholder:text-muted-foreground/80 sm:text-title"
          data-testid="editor-title"
        />
        <textarea
          ref={subtitleInput}
          value={subtitle}
          onChange={(event) => onSubtitleChange(event.target.value)}
          onKeyDown={onSubtitleKeyDown}
          placeholder={t("subtitlePlaceholder")}
          aria-label={t("subtitleLabel")}
          rows={1}
          maxLength={280}
          className="field-sizing-content resize-none overflow-hidden bg-transparent font-serif text-xl text-muted-foreground outline-none placeholder:text-muted-foreground/60"
          data-testid="editor-subtitle"
        />
      </div>

      <div className="mt-6 px-4 sm:px-0">
        {editor ? <SelectionToolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
        {!editor ? <div className="mx-auto h-64 max-w-[var(--measure)] animate-pulse rounded bg-muted" aria-hidden /> : null}
      </div>
      <p className="mx-auto mt-6 max-w-[var(--measure)] px-4 text-sm text-muted-foreground sm:px-0">{t("slashHint")}</p>

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPTED_IMAGE_TYPES}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        data-testid="image-input"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = "";
          void uploadFiles(files);
        }}
      />
      <UnsplashPicker trigger={null} open={unsplashOpen} onOpenChange={setUnsplashOpen} onSelect={onPickUnsplash} />
      <PublishDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        story={{ ...story, title, subtitle }}
        topics={topics}
        userId={userId}
        onPublished={(result) => {
          window.localStorage.removeItem(`fogata:draft:${story.id}`);
          if (result.scheduled) {
            router.push(`/${locale}/me/stories?published=scheduled`);
          } else {
            router.push(result.path);
          }
        }}
        onUnpublished={() => router.refresh()}
      />
    </div>
  );
}

function SaveLabel({ status, savedAt }: { status: SaveStatus; savedAt: Date | null }) {
  const t = useTranslations("Editor.status");
  const locale = useLocale();
  switch (status) {
    case "saving":
      return <>{t("saving")}</>;
    case "unsaved":
      return <>{t("unsaved")}</>;
    case "offline":
      return <>{t("offline")}</>;
    case "error":
      return <>{t("error")}</>;
    case "conflict":
      return <>{t("conflict")}</>;
    default:
      // The writer's own clock, not the site-wide UTC used for publish dates.
      return (
        <>{savedAt ? t("savedAt", { time: new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(savedAt) }) : t("saved")}</>
      );
  }
}
