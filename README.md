# Systems Cartography Portfolio

A self-hostable, brutalist developer portfolio that maps the configured owner's public GitHub repositories as an interactive systems landscape.

The published site is an owner-centric, read-only portfolio. Visitors inspect the configured owner's projects, architecture evidence, professional experience, deployed systems, LinkedIn, and contact channels. They do **not** connect their own GitHub account, upload a résumé, replace the operator, or personalize the running site in the browser.

Customization happens in a fork.

## Fork setup: one LinkedIn PDF import

The intended owner setup is deliberately small:

1. Fork the repository.
2. Export your LinkedIn profile as a PDF.
3. Install dependencies.
4. Run the one-time profile importer.
5. Generate the committed public GitHub repository snapshot.
6. Review the detected identity, repositories, and employment history.
7. Commit the generated files and deploy.

```bash
npm install
mkdir -p imports
# Put your LinkedIn PDF anywhere local; imports/ is convenient and PDF files there are gitignored.
npm run setup -- ./imports/linkedin-profile.pdf

# Generate the committed, owner-scoped GitHub repository snapshot
npm run sync:github
```

The importer (`npm run setup`):

- reads the LinkedIn PDF locally;
- extracts the owner name, headline, location, summary, email, LinkedIn URL, top skills, certifications, education text, and employment history;
- sorts employment current-first, then by most recent end/start date;
- groups consecutive roles at the same organization with progression metadata;
- marks an explicit promotion when the LinkedIn text says the owner was promoted;
- deduplicates exact certification duplicates;
- keeps ambiguous education lines raw instead of silently inventing a merged degree record;
- normally infers the GitHub profile from the fork's `origin` remote;
- shows a terminal review gate before writing source-controlled data;
- writes `src/data/ownerProfile.generated.ts` only after confirmation.

The GitHub sync tool (`npm run sync:github`):

- deep-inspects all eligible canonical public repositories with bounded concurrency;
- discovers and extracts bounded dependency manifests (`package.json`, `composer.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `requirements.txt`);
- aggregates technology evidence into synthesized capabilities and layer classifications;
- merges reviewed architectural evidence from `src/data/repositoryEvidence.ts`;
- owner-scopes the snapshot to prevent data leakage in forks;
- writes `src/data/githubSnapshot.generated.ts` for zero-network-dependency runtime execution.

The PDF itself is **never copied into the repository** and `imports/*.pdf` is gitignored. The generated TypeScript snapshots are durable public sources used by the portfolio after setup. The public application has no visitor upload UI and no browser-time GitHub API dependency.

If the git remote cannot be used to infer the GitHub profile, the setup command asks for it. It can also be supplied explicitly:

```bash
npm run setup -- ./imports/linkedin-profile.pdf --github https://github.com/your-user
npm run sync:github -- --github https://github.com/your-user
```

After generation, verify the fork:

```bash
npm test
npm run lint
npm run build
```

The product rule is simple: **the deployed instance showcases its configured owner; customization happens during fork setup and is committed to source control, not performed by public visitors.**

## Owner data model

`src/data/ownerProfile.generated.ts` is the canonical owner-profile snapshot after setup. It supplies:

- public identity and headline;
- LinkedIn and email contact details;
- professional experience in deterministic chronological order;
- promotion/progression metadata for multiple roles at the same organization;
- LinkedIn top skills and certification data;
- raw education text when the PDF is ambiguous;
- the GitHub profile target inferred from the fork.

`src/config/portfolioConfig.ts` consumes that generated data and remains the place for optional portfolio-specific overrides such as deployed project links and contact-form configuration. The page title, site ID, GitHub handle, GitHub profile link, operator role, and professional experience are derived from generated owner data so a fork does not retain another owner's identity by accident.

## GitHub data model

Public GitHub repository data is committed as a static snapshot in `src/data/githubSnapshot.generated.ts`. Repository metadata provides:

- public repository names and descriptions;
- languages, topics, and multi-manifest dependencies;
- stars, forks, open issues, license, and repository size;
- repository and homepage links.

Selected repositories can have reviewed evidence mappings in `src/data/repositoryEvidence.ts`. Those mappings must be supported by public README or code evidence. The application does not infer employment history, proficiency percentages, production uptime, performance benchmarks, SLAs, or business outcomes from GitHub.

Repository rendering is network-independent and performs zero visitor-time GitHub API calls. The portfolio loads its repository topology from the committed snapshot even when GitHub is unavailable. Fork safety is enforced by owner-scoping: if the configured `PORTFOLIO_CONFIG.githubTarget` does not match the committed snapshot, the UI displays `SNAPSHOT // REFRESH REQUIRED` instead of rendering mismatched data.

## Professional data provenance

LinkedIn-PDF imports become **CURATED** owner data after the owner reviews and confirms the generated snapshot. They are not labeled GitHub-verified. GitHub repository evidence and professional-history evidence remain separate provenance domains.

If a PDF field is absent or ambiguous, the importer prefers an explicit warning or raw retained text over inventing a value.

## Deployed projects

Manual deployed-project URLs can be added to `projectLinks` in `src/config/portfolioConfig.ts`. They override a repository's GitHub Website/Homepage value. If neither exists, the public UI omits the live-system action.

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
- Professional history imported from an owner-reviewed LinkedIn PDF is CURATED, not GitHub VERIFIED.
- Unknown information is shown as unknown, retained raw for review, or omitted.
- The site owner controls personal identity and contact details through the generated owner snapshot.
- Visitor input never becomes the canonical portfolio identity.
