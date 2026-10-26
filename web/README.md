# Official mode: WhatsApp Cloud API MCP server on Vercel

This folder is a Next.js app with two jobs:

- `/` is the project's landing page.
- `/api/mcp` is an MCP server for a **WhatsApp Business number**, using Meta's official [Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api). `/api/webhook` receives messages from Meta, and `/setup` shows what is configured.

Unlike the local binary in the repo root, this mode is fully sanctioned by Meta, runs without your computer, and cannot read personal chats or groups.

## What you can and cannot do

| | |
|---|---|
| Read | Messages received after the webhook is connected, plus messages sent through this server and (with Coexistence) echoes of what you send from the WhatsApp Business app. Meta has no API for older history. |
| Reply freely | Within 24 hours of the customer's last message (`send_text`, `send_media`, `send_buttons`, `send_reaction`). |
| Start a conversation / reply after 24 h | Only with an approved template (`send_template`). |
| Cost | Meta bills per delivered template message by category and country; each number gets 1,000 free service messages a month. Hosting fits Vercel's and Upstash's free tiers for small volumes. |

## Tools (12)

`list_conversations`, `list_messages`, `search_messages`, `get_media`, `list_templates`, `get_number_status`, `send_text`, `send_media`, `send_template`, `send_buttons`, `send_reaction`, `mark_read`.

## Setup

1. **Meta app.** At [developers.facebook.com/apps](https://developers.facebook.com/apps) create a *Business* app and add the WhatsApp product. Add your number (or onboard your existing WhatsApp Business app number with **Coexistence** to keep using the app). Create a **System User** in Business Settings with `whatsapp_business_messaging` and `whatsapp_business_management`, and generate a permanent token.
2. **Deploy.** Use the Deploy button on the landing page, or import this repo in Vercel with **Root Directory = `web`**. Set:

   | Variable | Value |
   |---|---|
   | `WHATSAPP_ACCESS_TOKEN` | the System User token |
   | `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp > API Setup |
   | `WHATSAPP_WABA_ID` | WhatsApp Business Account ID (for `list_templates`) |
   | `META_APP_SECRET` | App settings > Basic > App secret |
   | `WEBHOOK_VERIFY_TOKEN` | any random string |
   | `MCP_SECRET` | random, 24+ characters (`openssl rand -hex 24`) |
   | `GRAPH_API_VERSION` | optional, defaults to `v26.0` |

3. **Storage.** In the Vercel project: *Storage → Upstash Redis → Connect*. This adds `KV_REST_API_URL` / `KV_REST_API_TOKEN`. Redeploy.
4. **Webhook.** In the Meta app: *WhatsApp → Configuration*. Callback URL `https://<your-app>.vercel.app/api/webhook`, verify token = `WEBHOOK_VERIFY_TOKEN`. Subscribe to `messages`, and to `smb_message_echoes` if you use Coexistence.
5. **Check.** Open `https://<your-app>.vercel.app/setup?key=<MCP_SECRET>`.
6. **Connect your assistant.**

   ```json
   { "mcpServers": { "whatsapp-business": {
       "type": "http",
       "url": "https://<your-app>.vercel.app/api/mcp",
       "headers": { "Authorization": "Bearer <MCP_SECRET>" }
   } } }
   ```

   Clients that only accept a URL can use `https://<your-app>.vercel.app/api/mcp?key=<MCP_SECRET>`; treat that URL like a password.

## Security

- `/api/mcp` refuses every request until `MCP_SECRET` (24+ chars) is set, and then requires it.
- `/api/webhook` rejects any POST whose `X-Hub-Signature-256` does not match `META_APP_SECRET`, and ignores events for other numbers on the same WABA.
- `/setup` shows only which variables are present; live checks require the secret.
- Customer messages are untrusted input. The server's instructions tell the model to treat them as data and to confirm sends with you, but keep approval prompts on for send tools.

## Development

```bash
npm install
npm test        # unit tests (store, webhook parsing, signatures, auth)
npm run build
npm run e2e     # boots the build and exercises webhook + MCP end to end, without calling Meta
npm run dev     # without Redis env vars, an in-memory store is used
```
