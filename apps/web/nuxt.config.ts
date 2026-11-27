import { siteDescription as description, siteTitle as title } from "./app/utils/site"

export default defineNuxtConfig({
  compatibilityDate: "2026-06-23",

  modules: ["@nuxt/fonts", "@nuxtjs/color-mode", "@nuxtjs/seo", "@vueuse/motion/nuxt"],

  alias: {
    tslib: "tslib/tslib.es6.js",
  },

  colorMode: {
    classSuffix: "",
    fallback: "dark",
    preference: "dark",
  },

  fonts: {
    families: [
      {
        name: "Geist Mono",
        provider: "google",
        weights: ["400", "500", "600", "700"],
        subsets: ["latin"],
      },
    ],
  },

  site: {
    url: "https://trawl.germondai.com",
    name: "TRAWL",
    description,
    defaultLocale: "en",
  },

  seo: {
    meta: {
      themeColor: "#00e87a",
      ogTitle: `TRAWL - ${title}`,
      ogDescription: description,
      twitterCard: "summary_large_image",
      twitterTitle: `TRAWL - ${title}`,
      twitterDescription: description,
    },
  },

  ogImage: {
    enabled: false,
  },

  aiReady: false,
  skewProtection: false,

  robots: {
    credits: false,
  },

  sitemap: {
    zeroRuntime: true,
  },

  nitro: {
    compressPublicAssets: true,
    routeRules: {
      "/**": {
        headers: {
          "Content-Security-Policy":
            "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self' https://api.github.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          "Cache-Control": "public, max-age=0, must-revalidate",
          "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
          "Referrer-Policy": "strict-origin-when-cross-origin",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      },
      "/_nuxt/**": {
        headers: {
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      },
    },
  },

  app: {
    head: {
      title,
      templateParams: {
        siteName: "TRAWL",
        separator: "-",
      },
      link: [{ rel: "icon", type: "image/png", sizes: "512x512", href: "/favicon.png" }],
    },
  },
})
