import { useEffect, useMemo, useState } from "react";
import { createReservation, deleteReservation, fetchReservations } from "./api.js";
import { CLASSES, GRADES, PERIODS, ROOMS, WEEKDAY_LABELS } from "./constants.js";
import { addWeeks, formatWeekRange, getStartOfWeek, getWeekDays, toDateKey } from "./dateUtils.js";

const initialForm = {
  date: toDateKey(new Date()),
  period: 1,
  room: ROOMS[0],
  grade: 1,
  classNumber: 1,
  password: ""
};

const messageByCode = {
  DUPLICATE_RESERVATION: "이미 같은 시간에 예약된 특별실입니다.",
  VALIDATION_ERROR: "입력한 내용을 다시 확인해 주세요.",
  INVALID_PASSWORD: "삭제 비밀번호가 맞지 않습니다.",
  NOT_FOUND: "예약을 찾을 수 없습니다."
};

export default function App() {
  const [reservations, setReservations] = useState([]);
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [roomFilter, setRoomFilter] = useState("all");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const visibleReservations = useMemo(() => {
    const weekKeys = new Set(weekDays.map((day) => day.key));
    return reservations.filter((reservation) => {
      const inWeek = weekKeys.has(reservation.date);
      const matchesRoom = roomFilter === "all" || reservation.room === roomFilter;
      return inWeek && matchesRoom;
    });
  }, [reservations, roomFilter, weekDays]);

  useEffect(() => {
    loadReservations();
  }, []);

  async function loadReservations() {
    setLoading(true);
    try {
      setReservations(await fetchReservations());
      setMessage(null);
    } catch (error) {
      setMessage({ type: "error", text: "예약 목록을 불러오지 못했습니다." });
    } finally {
      setLoading(false);
    }
  }

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!form.password.trim()) {
      setMessage({ type: "error", text: "삭제 비밀번호를 입력해 주세요." });
      return;
    }

    setSaving(true);
    try {
      const reservation = await createReservation({
        ...form,
        period: Number(form.period),
        grade: Number(form.grade),
        classNumber: Number(form.classNumber),
        password: form.password.trim()
      });
      setReservations((current) => [...current, reservation]);
      setMessage({ type: "success", text: "예약되었습니다." });
      setForm((current) => ({ ...current, password: "" }));
    } catch (error) {
      setMessage({
        type: "error",
        text: messageByCode[error.code] ?? "예약을 저장하지 못했습니다."
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reservation) {
    const password = window.prompt(`${reservation.room} ${reservation.grade}학년 ${reservation.classNumber}반 예약의 삭제 비밀번호를 입력해 주세요.`);

    if (!password) {
      return;
    }

    try {
      await deleteReservation(reservation.id, password);
      setReservations((current) => current.filter((item) => item.id !== reservation.id));
      setMessage({ type: "success", text: "예약을 삭제했습니다." });
    } catch (error) {
      setMessage({
        type: "error",
        text: messageByCode[error.code] ?? "예약을 삭제하지 못했습니다."
      });
    }
  }

  function reservationsFor(date, period) {
    return visibleReservations
      .filter((reservation) => reservation.date === date && reservation.period === period)
      .sort((a, b) => a.room.localeCompare(b.room, "ko-KR"));
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="top-bar">
          <div>
            <p className="eyebrow">특별실 예약</p>
            <h1>이번 주 예약표</h1>
            <p className="week-range">{formatWeekRange(weekStart)}</p>
          </div>

          <div className="week-actions" aria-label="주 이동">
            <button type="button" onClick={() => setWeekStart((date) => addWeeks(date, -1))}>
              이전 주
            </button>
            <button type="button" onClick={() => setWeekStart(getStartOfWeek(new Date()))}>
              이번 주
            </button>
            <button type="button" onClick={() => setWeekStart((date) => addWeeks(date, 1))}>
              다음 주
            </button>
          </div>
        </header>

        <div className="content-grid">
          <section className="schedule-area" aria-label="주간 예약표">
            <div className="schedule-toolbar">
              <label>
                특별실
                <select value={roomFilter} onChange={(event) => setRoomFilter(event.target.value)}>
                  <option value="all">전체</option>
                  {ROOMS.map((room) => (
                    <option key={room} value={room}>
                      {room}
                    </option>
                  ))}
                </select>
              </label>

              <button type="button" className="ghost-button" onClick={loadReservations}>
                새로고침
              </button>
            </div>

            <div className="schedule-scroll">
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>교시</th>
                    {weekDays.map((day, index) => (
                      <th key={day.key}>
                        <span>{WEEKDAY_LABELS[index]}</span>
                        <strong>{day.label}</strong>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERIODS.map((period) => (
                    <tr key={period}>
                      <th>{period}교시</th>
                      {weekDays.map((day) => {
                        const dayReservations = reservationsFor(day.key, period);
                        return (
                          <td key={`${day.key}-${period}`}>
                            {loading ? (
                              <span className="muted">불러오는 중</span>
                            ) : dayReservations.length === 0 ? (
                              <span className="empty-slot">비어 있음</span>
                            ) : (
                              <div className="reservation-list">
                                {dayReservations.map((reservation) => (
                                  <article className="reservation-item" key={reservation.id}>
                                    <div>
                                      <strong>{reservation.room}</strong>
                                      <span>
                                        {reservation.grade}학년 {reservation.classNumber}반
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      className="delete-button"
                                      onClick={() => handleDelete(reservation)}
                                    >
                                      삭제
                                    </button>
                                  </article>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className="form-panel" aria-label="예약 입력">
            <div className="panel-heading">
              <p className="eyebrow">새 예약</p>
              <h2>특별실 예약</h2>
            </div>

            {message ? <p className={`message ${message.type}`}>{message.text}</p> : null}

            <form onSubmit={handleSubmit}>
              <label>
                날짜
                <input
                  type="date"
                  value={form.date}
                  onChange={(event) => updateForm("date", event.target.value)}
                  required
                />
              </label>

              <div className="form-row">
                <label>
                  교시
                  <select value={form.period} onChange={(event) => updateForm("period", event.target.value)}>
                    {PERIODS.map((period) => (
                      <option key={period} value={period}>
                        {period}교시
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  특별실
                  <select value={form.room} onChange={(event) => updateForm("room", event.target.value)}>
                    {ROOMS.map((room) => (
                      <option key={room} value={room}>
                        {room}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="form-row">
                <label>
                  학년
                  <select value={form.grade} onChange={(event) => updateForm("grade", event.target.value)}>
                    {GRADES.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}학년
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  반
                  <select value={form.classNumber} onChange={(event) => updateForm("classNumber", event.target.value)}>
                    {CLASSES.map((classNumber) => (
                      <option key={classNumber} value={classNumber}>
                        {classNumber}반
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label>
                삭제 비밀번호
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateForm("password", event.target.value)}
                  minLength={2}
                  required
                />
              </label>

              <button type="submit" className="primary-button" disabled={saving}>
                {saving ? "저장 중" : "예약하기"}
              </button>
            </form>
          </aside>
        </div>
      </section>
    </main>
  );
}
