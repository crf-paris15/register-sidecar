import express from "express";

const SMTP_CLIENT = process.env.SMTP_CLIENT || "";

const app = express();
app.disable("x-powered-by");
app.use(express.json());

app.get("/event", (req: express.Request, res: express.Response) => {
  console.log("GET /event", req.query);
  res.status(200).json({ message: "OK" });
});

// Health check endpoint
app.get("/health", (_: express.Request, res: express.Response) => {
  res.status(200).send("OK");
});

app.listen(process.env.PORT ? Number(process.env.PORT) : 3003);
