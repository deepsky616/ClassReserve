import { createReservationApp } from "./reservationRoutes.js";
import { createReservationStore } from "./reservationStore.js";

const port = Number(process.env.PORT ?? 3001);
const store = createReservationStore();
const app = createReservationApp({ store });

app.listen(port, () => {
  console.log(`특별실 예약 서버가 ${port}번 포트에서 실행 중입니다.`);
});
