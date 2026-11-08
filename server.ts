import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '10mb' }));

// Ensure index.html and service worker are always fresh and never cached stale on mobile devices
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js' || req.path.endsWith('.webmanifest')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  next();
});

// Initialize GoogleGenAI on the server side
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

interface ChatMessage {
  role: 'user' | 'model';
  content: string;
}

interface FinancialContext {
  selectedMonth?: string;
  totalExpenses?: number;
  totalIncome?: number;
  balance?: number;
  topCategories?: { group: string; total: number; percentage: number }[];
  topOrigins?: { origin: string; total: number; percentage: number }[];
  topExpenses?: {
    description: string;
    value: number;
    group: string;
    origin: string;
    purchaseDate?: string;
    month: string;
    paid: boolean;
  }[];
  recentPurchasesWithDate?: {
    description: string;
    value: number;
    purchaseDate: string;
    origin: string;
    group: string;
  }[];
  rawExpensesCount?: number;
}

// POST /api/chat - Stream chat responses for financial insights
app.post('/api/chat', async (req: Request, res: Response): Promise<void> => {
  const { messages, context }: { messages: ChatMessage[]; context?: FinancialContext } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Nenhuma mensagem fornecida.' });
    return;
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  try {
    const systemInstruction = `Você é o "Consultor Financeiro Pessoal" do aplicativo Financeiro Casa.
Sua missão é analisar os dados financeiros do usuário, responder dúvidas com clareza e fornecer insights práticos e inteligentes sobre gastos, economia e hábitos financeiros.

Diretrizes importantes:
1. Seja amigável, direto, construtivo e fale em Português do Brasil (pt-BR).
2. Use formatação em moeda brasileira (R$ 1.234,56).
3. Baseie suas respostas ESTRITAMENTE nos dados financeiros reais fornecidos no contexto abaixo.
4. Quando o usuário perguntar "onde gastou mais", responda detalhadamente:
   - Identifique a categoria principal com o maior total gasto e a porcentagem correspondente.
   - Aponte a origem/cartão que teve maior volume de débitos.
   - Liste os 3 a 5 maiores lançamentos individuais de despesa com seus respectivos valores e, se houver, a Data da Compra.
   - Forneça 1 ou 2 sugestões práticas de economia ou alerta sobre esses gastos.
5. Utilize tópicos com emojis e negrito para deixar a leitura agradável e escaneável.
6. Se perguntarem sobre compras recentes ou datas específicas, aproveite a informação da "Data da Compra" quando disponível nos dados.

Contexto financeiro atual do usuário:
${context ? JSON.stringify(context, null, 2) : 'Nenhum contexto de despesas disponível no momento.'}`;

    // Format contents history for Gemini API
    const formattedContents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-3.8-flash',
      contents: formattedContents,
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    for await (const chunk of responseStream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err: any) {
    console.error('Error in /api/chat Gemini streaming:', err);
    const errorMessage =
      err?.message || 'Ocorreu um erro ao comunicar com a inteligência artificial.';
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

// Setup Vite middleware in dev or static files in prod
async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Financeiro Casa running at http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
