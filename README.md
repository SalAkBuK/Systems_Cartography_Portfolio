# Systems Cartography Portfolio

A self-hostable, brutalist developer portfolio that maps the configured owner's public GitHub repositories as an interactive systems landscape.

The published site is an owner-centric, read-only portfolio. Visitors inspect the configured owner's projects, architecture evidence, professional experience, deployed systems, LinkedIn, and contact channels. They do **not** connect their own GitHub account, upload a résumé, replace the operator, or personalize the running site in the browser.

Customization happens in a fork.

## Fork for your own portfolio

1. Click **Use this template** on GitHub, or fork the repository.
2. Edit `src/config/portfolioConfig.ts` in your fork:
   - `siteId`
   - `pageTitle` and `metaDescription`
   - `githubTarget`
   - `templateRepositoryUrl`
   - `operator` identity and contact fields
   - `operator.contact.linkedin`
   - optional `experience` entries
   - optional `projectLinks` deployment overrides
3. Copy `.env.example` to `.env` only if you want form delivery.
4. Install and verify:

```bash
npm install
npm test
npm run lint
npm run build
```

5. Deploy your fork to Netlify, Vercel, Cloudflare Pages, GitHub Pages, or another static host.

The product rule is simple: **the deployed instance showcases its configured owner; customization happens in source control, not inside the public portfolio.**

## GitHub data model

The configured GitHub profile is loaded automatically. Repository metadata may provide:

- public repository names and descriptions;
- languages and topics;
- stars, forks, open issues, license, and repository size;
- repository and homepage links.

Selected repositories can have reviewed evidence mappings in `src/data/repositoryEvidence.ts`. Those mappings must be supported by public README or code evidence. The application does not infer employment history, proficiency percentages, production uptime, performance benchmarks, SLAs, or business outcomes.

If GitHub is temporarily unavailable, the most recently cached public repository snapshot can still render. Cached repository data is a resilience mechanism, not a visitor-personalization feature.

## Professional data

Owner-controlled professional information lives in `src/config/portfolioConfig.ts`.

- LinkedIn uses `operator.contact.linkedin`.
- Employment history uses `experience`.
- Manual deployed-project URLs use `projectLinks` and override a repository's GitHub homepage when present.
- If those fields are empty, the corresponding public UI is omitted rather than showing placeholders or inviting visitor input.

## Contact form

The contact page always exposes the configured direct email address. With no endpoint, submitting the form opens the visitor's email application.

To deliver the form through Formspree or another compatible endpoint, set:

```env
VITE_CONTACT_FORM_ENDPOINT=https://formspree.io/f/your-form-id
```

Do not place SMTP passwords, API keys, or private email-provider credentials in a `VITE_` variable; Vite exposes those values to the browser. Use a hosted form endpoint or a serverless function that keeps secrets on the server.

The form includes a hidden honeypot field, but the receiving endpoint should also provide rate limiting and abuse protection.

## Local development

```bash
npm install
npm run dev
```

Then open `http://127.0.0.1:3000`.

## Evidence policy

- GitHub metadata is labeled as GitHub metadata.
- Architecture is shown only when supported by reviewed or repository-derived evidence.
- Unknown information is shown as unknown or omitted.
- The site owner controls personal identity and contact details in `portfolioConfig.ts`.
- Visitor input never becomes the canonical portfolio identity.
