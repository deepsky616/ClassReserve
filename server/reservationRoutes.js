import express from "express";

export function createReservationApp({ store }) {
  const app = express();

  app.use(express.json());
  app.use(express.static("dist"));

  app.get("/api/reservations", async (request, response, next) => {
    try {
      const reservations = await store.listReservations();
      response.json({ reservations });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reservations", async (request, response, next) => {
    try {
      const reservation = await store.createReservation(request.body);
      response.status(201).json({ reservation });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/reservations/:id", async (request, response, next) => {
    try {
      const result = await store.deleteReservation(request.params.id, request.body?.password);
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.use((error, request, response, next) => {
    if (response.headersSent) {
      next(error);
      return;
    }

    response.status(error.status ?? 500).json({
      code: error.code ?? "SERVER_ERROR",
      message: error.message ?? "서버 오류가 발생했습니다."
    });
  });

  return app;
}
