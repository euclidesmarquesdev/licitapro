import { Queue, Worker, Job } from "bullmq";
import { redis } from "../config/redis";
import { extractBiddingMetadata } from "../services/gemini";

// Setup background BullMQ queue for heavy/long-running processes
export const scrapingQueue = new Queue("licitapro-scraping-queue", {
  connection: redis || undefined // Falls back to standard client configurations safely
});

/**
 * Interface representing details of background crawler job
 */
export interface ScraperJobPayload {
  url: string;
  userId: string;
  email: string;
  docType?: string;
}

/**
 * Initializes the background BullMQ worker instance to process PNCP scraping non-blockingly
 */
export function startBaddJobWorker() {
  if (!redis) {
    console.warn("[LicitaPro BullMQ] Conexão com Redis indisponível. Inicialização do Worker de fila ignorada.");
    return null;
  }

  const worker = new Worker(
    "licitapro-scraping-queue",
    async (job: Job<ScraperJobPayload>) => {
      console.log(`[LicitaPro worker] Iniciando Processamento assíncrono do Job #${job.id}:`, job.data);
      const { url } = job.data;

      // Simulate step increments
      await job.updateProgress(10);

      // Perform real background scraping utilizing Gemini's semantic extraction
      const { parsed, usage } = await extractBiddingMetadata("", url, true);
      await job.updateProgress(80);

      console.log(`[LicitaPro worker] Concluído scraping assíncrono para ${url}. Consumo:`, usage);
      await job.updateProgress(100);

      return {
        success: true,
        data: parsed,
        jobId: job.id,
        processedAt: new Date().toISOString()
      };
    },
    {
      connection: redis,
      concurrency: 5 // Process up to 5 concurrent jobs at once
    }
  );

  worker.on("completed", (job) => {
    console.log(`[LicitaPro worker] Fila de tarefas concluiu o Job #${job.id} com sucesso!`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[LicitaPro worker] Fila de tarefas falhou no processamento do Job #${job?.id}:`, err);
  });

  return worker;
}

/**
 * Utility helper to schedule a new worker job inside the Redis-backed BullMQ queue
 */
export async function scheduleAsyncScraper(payload: ScraperJobPayload) {
  try {
    const job = await scrapingQueue.add("pncp-crawl-job", payload, {
      attempts: 3, // Retry up to 3 times on unexpected failure
      backoff: {
        type: "exponential",
        delay: 5000 // Exponential backoff starting from 5 seconds
      }
    });
    console.log(`[LicitaPro worker] Novo job de scraping agendado com sucesso! ID: ${job.id}`);
    return job;
  } catch (err) {
    console.error("[LicitaPro worker] Erro ao registrar job assíncrono na fila BullMQ:", err);
    throw err;
  }
}
