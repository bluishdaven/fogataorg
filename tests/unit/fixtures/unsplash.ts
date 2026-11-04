/** Shaped like Unsplash API search results (fictional photos and photographers). */
export function apiPhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: "Fg4tA0campfire",
    width: 4000,
    height: 2667,
    color: "#d96a26",
    blur_hash: "LKO2?U%2Tw=w]~RBVZRi};RPxuwH",
    description: null,
    alt_description: "people sitting around a campfire on the beach",
    urls: {
      raw: "https://images.unsplash.com/photo-1500000000000-abc123?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Y2FtcGZpcmV8ZW58MHx8fHwxNzkzODI2MDAwfDA&ixlib=rb-4.0.3",
      regular: "https://images.unsplash.com/photo-1500000000000-abc123?w=1080",
    },
    links: {
      html: "https://unsplash.com/photos/people-around-a-campfire-Fg4tA0campfire",
      download_location: "https://api.unsplash.com/photos/Fg4tA0campfire/download?ixid=abc",
    },
    user: {
      name: "Ana Ruiz",
      username: "anaruiz_photo",
      links: { html: "https://unsplash.com/@anaruiz_photo" },
    },
    ...overrides,
  };
}
