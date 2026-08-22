import express from "express"
import path from "path"
import cors from "cors"
import dotenv from "dotenv"
dotenv.config({ override: true })
import { createServer as createViteServer } from "vite"
import { GoogleGenAI } from "@google/genai"

const apiKey = process.env.GEMINI_API_KEY || ""
console.log("Initializing Gemini with key prefix:", apiKey.substring(0, 5))
const ai = new GoogleGenAI({ apiKey });


async function startServer() {
  const app = express()
  const PORT = process.env.PORT || 3000

  app.use(cors())
  app.use(express.json())

  // Dummy mock data representing what we would pull from Notion
  const TASK_UPDATES = [
    {
      project: "Platform Rebrand",
      owner: "Maya Chen",
      status: "blocked",
      progress: 78,
      blocker: "Stakeholder sign-off pending",
      blockerAgeDays: 3,
    },
    {
      project: "API v3 Launch",
      owner: "James Park",
      status: "blocked",
      progress: 64,
      blocker: "Load test environment not allocated",
      blockerAgeDays: 2,
    },
    {
      project: "Customer Portal",
      owner: "Sara Liu",
      status: "at_risk",
      progress: 86,
      blocker: "Legal review pending",
      blockerAgeDays: 5,
    },
    {
      project: "Partner Onboarding",
      owner: "Ari Patel",
      status: "in_progress",
      progress: 72,
    },
    {
      project: "Billing Automation",
      owner: "Noah Kim",
      status: "in_progress",
      progress: 58,
    },
    {
      project: "Security Audit",
      owner: "Dina Rahman",
      status: "done",
      progress: 100,
    },
    {
      project: "Support AI Copilot",
      owner: "Ethan Hall",
      status: "done",
      progress: 100,
    },
    {
      project: "Data Warehouse Cleanup",
      owner: "Lena Ortiz",
      status: "at_risk",
      progress: 49,
    },
    {
      project: "Retention Campaign",
      owner: "Ivy Gomez",
      status: "done",
      progress: 100,
    },
    {
      project: "Compliance Vault",
      owner: "Marco Silva",
      status: "in_progress",
      progress: 68,
    },
  ]

  // API route to trigger the workflow
  app.post("/api/workflow/run", async (req, res) => {
    try {
      const { settings, insights } = req.body

      let aiSummary = ""
      let slackPreview = ""

      // If we have an API key, generate a real summary with Gemini
      if (process.env.GEMINI_API_KEY) {
        const prompt = `
          You are a BizOps AI Agent analyzing weekly task updates. 
          Here are the insights derived from our task tracker:
          Total Tasks: ${insights.totalTasks}
          Completed: ${insights.completedTasks}
          In Progress: ${insights.inProgressTasks}
          At Risk: ${insights.atRiskTasks}
          
          Blockers: ${JSON.stringify(insights.blockers)}
          
          Generate a concise, professional executive brief to be posted in Slack.
          Focus on health, delivery progress, risks, and recommended actions for leadership.
        `

        try {
          const response = await ai.models.generateContent({
            model: settings.model || "gemini-3.7-flash",
            contents: prompt,
          })
          slackPreview = response.text || ""
        } catch (error) {
          console.error("Gemini API Error:", error)
          slackPreview =
            "Error generating AI summary. Details: " +
            (error instanceof Error ? error.message : String(error))
        }
      } else {
        // Fallback mock summary if no API key is provided
        slackPreview = [
          "*BizOps Weekly Executive Brief (Mocked)*",
          `*Week of ${new Date().toLocaleDateString()}*`,
          "",
          `*Health:* ${insights.health} (${insights.confidence}% confidence)`,
          `*Delivery:* ${insights.completedTasks}/${insights.totalTasks} complete, ${insights.inProgressTasks} in progress`,
          `*Risk:* ${insights.blockers.length} blockers, ${insights.atRiskTasks} at-risk tasks`,
          "",
          "*Actions for leadership:*",
          ...insights.blockers
            .slice(0, 2)
            .map((b: any) => `- ${b.project}: ${b.summary} (${b.owner})`),
        ].join("\\n")
      }

      res.json({
        success: true,
        data: {
          slackPreview,
          runId: Date.now().toString(),
          timestamp: new Date().toISOString(),
        },
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: "Failed to run workflow" })
    }
  })

  // API route to publish to Slack
  app.post("/api/workflow/publish", async (req, res) => {
    try {
      const { slackChannel, payload } = req.body

      // Here we would use the Slack API to post the message.
      // e.g. await slackClient.chat.postMessage({ channel: slackChannel, text: payload });

      // For the mock, we just simulate success.
      setTimeout(() => {
        res.json({
          success: true,
          message: `Successfully posted to ${slackChannel}`,
        })
      }, 800)
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: "Failed to publish to Slack" })
    }
  })

  // API route to fetch latest updates (Ingest phase)
  app.get("/api/tasks/updates", (req, res) => {
    // In a real app, this would query Notion API
    res.json({ tasks: TASK_UPDATES })
  })

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    })
    app.use(vite.middlewares)
  } else {
    const distPath = path.join(process.cwd(), "dist")
    app.use(express.static(distPath))
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"))
    })
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

startServer()
