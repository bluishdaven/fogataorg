/**
 * Fictional writers and the topic catalog. Emails use the reserved .test TLD,
 * so nothing here can reach a real inbox.
 */

export type SeedAuthor = {
  username: string;
  displayName: string;
  email: string;
  locale: "en" | "es";
  bio: string;
};

export const authors: SeedAuthor[] = [
  {
    username: "lucia_ortega",
    displayName: "Lucía Ortega",
    email: "lucia@fogata.test",
    locale: "es",
    bio: "Cocinera y escritora en Oaxaca. Escribo sobre la comida como forma de memoria.",
  },
  {
    username: "mateo_rios",
    displayName: "Mateo Ríos",
    email: "mateo@fogata.test",
    locale: "es",
    bio: "Urbanista de a pie en la Ciudad de México. Metro, mercados y banquetas rotas.",
  },
  {
    username: "danawrites",
    displayName: "Dana Whitfield",
    email: "dana@fogata.test",
    locale: "en",
    bio: "Essays about rivers, birds and the practice of paying attention. Portland, Oregon.",
  },
  {
    username: "arjun_builds",
    displayName: "Arjun Mehta",
    email: "arjun@fogata.test",
    locale: "en",
    bio: "I build small software for small teams and write about the parts that break.",
  },
  {
    username: "valecruz",
    displayName: "Valentina Cruz",
    email: "valentina@fogata.test",
    locale: "es",
    bio: "De Bogotá a Austin. Escribo en dos idiomas sobre vivir entre ellos. Writing in two languages about living between them.",
  },
  {
    username: "sofia_herrera",
    displayName: "Sofía Herrera",
    email: "sofia@fogata.test",
    locale: "es",
    bio: "Librera en Buenos Aires. Recomiendo libros que nadie me pidió.",
  },
  {
    username: "marcusbell",
    displayName: "Marcus Bell",
    email: "marcus@fogata.test",
    locale: "en",
    bio: "Bass player and music teacher in Chicago. Notes on sound and the people who make it.",
  },
  {
    username: "ines_delgado",
    displayName: "Inés Delgado",
    email: "ines@fogata.test",
    locale: "es",
    bio: "Diseñadora tipográfica en Madrid. Type designer. Las letras también tienen acento.",
  },
];

export type SeedTopic = { slug: string; nameEn: string; nameEs: string };

export const topicCatalog: SeedTopic[] = [
  { slug: "writing", nameEn: "Writing", nameEs: "Escritura" },
  { slug: "food", nameEn: "Food", nameEs: "Comida" },
  { slug: "cities", nameEn: "Cities", nameEs: "Ciudades" },
  { slug: "nature", nameEn: "Nature", nameEs: "Naturaleza" },
  { slug: "technology", nameEn: "Technology", nameEs: "Tecnología" },
  { slug: "books", nameEn: "Books", nameEs: "Libros" },
  { slug: "music", nameEn: "Music", nameEs: "Música" },
  { slug: "migration", nameEn: "Migration", nameEs: "Migración" },
  { slug: "language", nameEn: "Language", nameEs: "Idiomas" },
  { slug: "design", nameEn: "Design", nameEs: "Diseño" },
  { slug: "family", nameEn: "Family", nameEs: "Familia" },
  { slug: "work", nameEn: "Work", nameEs: "Trabajo" },
  { slug: "memory", nameEn: "Memory", nameEs: "Memoria" },
  { slug: "travel", nameEn: "Travel", nameEs: "Viajes" },
];
