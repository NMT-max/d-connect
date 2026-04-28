import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export async function generateMarketingContent(prompt: string, channel: 'facebook' | 'instagram' | 'email', language: 'bangla' | 'english' | 'both') {
  const languageReq = language === 'bangla' ? 'Produce the content in Bangla.' : language === 'english' ? 'Produce the content in English.' : 'Produce the content in both Bangla and English.';
  
  const channelContext = {
    facebook: `System Prompt: You are a social media expert. Create an engaging Facebook post including relevant emojis. Length: 150-200 words. ${languageReq}`,
    instagram: `System Prompt: You are an Instagram influencer. Create a catchy Instagram caption with relevant hashtags. Length: 100-150 words. ${languageReq}`,
    email: `System Prompt: You are a professional copywriter. Create a professional email body with a clear subject line. Length: 200-300 words. ${languageReq}`
  };

  const fullPrompt = `${channelContext[channel]}\n\nTopic/Idea: ${prompt}`;
  
  try {
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Error generating content. Please check your API key.";
  }
}
