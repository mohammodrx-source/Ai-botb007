MX AI Chatbot Backend — deployment notes

IMPORTANT: This code is a backend implementation, not an already-connected live bot. It will not auto-reply until Meta assets, webhook subscriptions, and environment variables are configured.

Files: server.js and package.json
Node.js 18+ required (Render Node environment).

Keep your existing Render service and repository. Replace the existing server.js with this version, and update package.json only if needed. Commit and let Render deploy.

Required Render Environment Variables:
OPENAI_API_KEY = your OpenAI API key
OPENAI_MODEL = gpt-4.1-mini (or a model available to your account)
META_VERIFY_TOKEN = a long random string you create; use the exact same string in Meta webhook setup
META_APP_SECRET = App Secret from Meta app settings (required for webhook signature validation)
PAGE_ACCESS_TOKEN = Facebook Page access token with required messaging permissions
WHATSAPP_ACCESS_TOKEN = WhatsApp Cloud API access token
WHATSAPP_PHONE_NUMBER_ID = phone number ID from WhatsApp API setup, not the displayed phone number
GRAPH_API_VERSION = a currently supported Graph API version such as v23.0; confirm the current supported version in Meta dashboard/docs
BUSINESS_NAME = your business name
BUSINESS_INFO = products, prices, delivery rules, opening hours, etc. Do not put secrets here.
WEBHOOK_SIGNATURE_REQUIRED = true (default; do not turn off for production)

Endpoints:
GET / -> basic health message
GET /api/status -> service and configuration status (does not reveal secrets)
POST /api/chat -> JSON body {"message":"Hello","mode":"web"}
GET /webhook -> Meta webhook verification
POST /webhook -> receives WhatsApp and Messenger webhook events

Meta setup still required:
1. In Meta Developers, configure the app and add Messenger and WhatsApp products/use cases as available.
2. Configure callback URL: https://ai-backend-api-yhx6.onrender.com/webhook
3. Verify token must match META_VERIFY_TOKEN.
4. Subscribe the app to WhatsApp messages and the Facebook Page messaging events as required.
5. Grant required permissions and use a valid Page access token and WhatsApp access token.
6. Configure WhatsApp Business Account/phone number and ensure it is allowed for Cloud API use.
7. Confirm GRAPH_API_VERSION is currently supported by Meta.

Security and limitations:
- Never put tokens or app secret in HTML or send them in chat.
- This starter uses in-memory processing only; add persistent deduplication/queue/rate limits before production scale.
- It currently auto-replies to inbound text messages only; image/audio/order workflows are not implemented.
- Respect Meta messaging windows, template rules, opt-in, and platform policies. Test using a test page/number first.
- If Render has an older Node version, set Node >=18 in Render environment/build settings.
