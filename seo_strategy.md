# SEO Strategy

## In scope
- Public landing page (`/`, `public/index.html`)
- Shared crawl files (`public/robots.txt`, `public/sitemap.xml`, optional `llms.txt`)
- Public utility/auth pages only for crawl-governance review (`/login.html`, `/account.html`, `/admin`, `/admin.html`, `/dashboard.html`, `/dashboard/:token`)

## Out of scope
- Authenticated dashboard behavior after login
- Token-specific bot management content behind `/dashboard/:token`
- Internal admin operations and API responses, except where their HTML shells are publicly crawlable
- Bot command content and WhatsApp runtime features

## Target audience
- French-speaking users who want to create and manage self-hosted WhatsApp bots quickly.

## Primary keywords
- bot WhatsApp
- créer un bot WhatsApp
- bot WhatsApp self-hosted
- bot WhatsApp Baileys
- dashboard bot WhatsApp

## Dismissed categories
- (None yet)

## Notes from scans
- The homepage is the primary search landing page.
- Login, account, admin, and tokenized dashboard pages are utility surfaces and should be treated as non-indexable rather than SEO targets.
