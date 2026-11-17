# BuildMaster AI — starter

This is a first working project scaffold, not a finished autonomous coding agent.

## Run locally
1. Install Node.js 20 or newer.
2. In this folder run: `npm install`
3. Copy `.env.example` to `.env`.
4. Put your AI provider key in `.env` on your own computer/server. Never paste it into chat or commit `.env` to GitHub.
5. Run: `npm start`
6. Open `http://localhost:3000`

Without a key, the app shows a clearly labelled local demo plan. With a valid OpenAI API key and a model available to your API account:
- `/api/plan` creates a project plan.
- `/api/build` asks the AI to generate a starter project, validates the returned relative file paths and size, and packages the files into a ZIP for download.

## Safety
- API key is read only by `server.js`; it is not embedded in browser code.
- `.env` is excluded by `.gitignore`.
- This starter does not yet write arbitrary project files, execute generated code, connect a database, or deploy apps. Those require a controlled workspace, sandbox, permissions, and additional implementation.

## Project generation limitations
Generated projects are starter code, not guaranteed production-ready software. Review and test every generated file before use. This version does not execute generated code, deploy to hosting, or connect to external accounts.

## Online deployment (Render)
1. Create a private GitHub repository for this project and upload these project files (do not upload `.env`).
2. In Render, choose **New > Blueprint** and connect that repository.
3. Render reads `render.yaml` and creates the Node web service.
4. In the service's Environment settings, add `OPENAI_API_KEY` as a secret. Never put the key in `public/` or commit it to GitHub.
5. Deploy. When the deploy finishes, open the Render URL and check `/api/health`.

The free hosting plan may sleep or have limits. Availability and pricing can change. The app is not online until you complete the account-authorized deployment steps.
