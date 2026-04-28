import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", environment: process.env.NODE_ENV || "development" });
  });

  // WhatsApp API Proxy Route
  app.post("/api/whatsapp/send", async (req, res) => {
    const { to, message, mediaUrl, token: bodyToken, phoneId: bodyPhoneId } = req.body;
    const token = bodyToken || process.env.WHATSAPP_TOKEN;
    const phoneId = bodyPhoneId || process.env.WHATSAPP_PHONE_NUMBER_ID;

    if (!token || !phoneId) {
      return res.status(400).json({ error: "WhatsApp API credentials missing. Please set them in Social Hub settings." });
    }

    // Clean phone number: remove any non-digit characters
    const cleanTo = to.replace(/\D/g, "");

    try {
      const payload: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanTo,
        type: "text",
        text: { body: message }
      };

      if (mediaUrl) {
         // Sending media requires a different payload structure usually
         // For now, let's stick to text or include link in text.
         payload.text.body = `${message}\n\nMedia: ${mediaUrl}`;
      }

      const response = await axios.post(
        `https://graph.facebook.com/v17.0/${phoneId}/messages`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      res.json(response.data);
    } catch (error: any) {
      console.error("WhatsApp Send Error:", error.response?.data || error.message);
      res.status(error.response?.status || 500).json(error.response?.data || { error: "Failed to send message" });
    }
  });

  // Webhook for verification (Meta requirement)
  app.get("/api/whatsapp/webhook", (req, res) => {
    const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode && token) {
      if (mode === "subscribe" && token === verifyToken) {
        console.log("WEBHOOK_VERIFIED");
        res.status(200).send(challenge);
      } else {
        res.sendStatus(403);
      }
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
