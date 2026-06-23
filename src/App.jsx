import { useEffect, useMemo, useState } from "react";
import { createReservation, deleteReservation, fetchReservations } from "./api.js";
import { GRADES, KINDERGARTEN_GRADE, PERIODS, ROOM_TONE_CLASSES, ROOMS, WEEKDAY_LABELS } from "./constants.js";
import { addWeeks, formatWeekRange, getStartOfWeek, getWeekDays, toDateKey } from "./dateUtils.js";
import { formatReservationOwner } from "./reservationLabels.js";
import {
  getClassOptionsForGrade,
  getReservationDateRange,
  isKindergartenGrade,
  normalizeClassNumberValue,
  normalizeGradeValue
} from "./reservationRules.js";

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
  NOT_FOUND: "예약을 찾을 수 없습니다.",
  CONFIG_MISSING: "구글 앱스 스크립트 주소가 설정되지 않았습니다.",
  GOOGLE_SCRIPT_UNAVAILABLE: "구글 시트 저장소에 연결할 수 없습니다.",
  GOOGLE_SCRIPT_ERROR: "구글 시트 저장소 요청을 처리하지 못했습니다."
};

function errorMessage(error, fallback) {
  if (error.code === "DUPLICATE_RESERVATION" && error.message) {
    return error.message;
  }

  return messageByCode[error.code] ?? error.message ?? fallback;
}

function normalizeGradeForSubmit(grade) {
  return normalizeGradeValue(grade);
}

function gradeLabel(grade) {
  return grade === KINDERGARTEN_GRADE ? KINDERGARTEN_GRADE : `${grade}학년`;
}

export default function App() {
  const [reservations, setReservations] = useState([]);
  const [weekStart, setWeekStart] = useState(() => getStartOfWeek(new Date()));
  const [roomFilter, setRoomFilter] = useState("all");
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [viewMode, setViewMode] = useState("table");

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const dateRange = useMemo(() => getReservationDateRange(new Date()), []);
  const classOptions = useMemo(() => getClassOptionsForGrade(form.grade), [form.grade]);
  const isKindergarten = isKindergartenGrade(form.grade);

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
    setConnectionStatus("checking");
    try {
      setReservations(await fetchReservations());
      setMessage(null);
      setConnectionStatus("connected");
    } catch (error) {
      setConnectionStatus("error");
      setMessage({
        type: "error",
        text: errorMessage(error, "예약 목록을 불러오지 못했습니다.")
      });
    } finally {
      setLoading(false);
    }
  }

  function updateForm(field, value) {
    setForm((current) => {
      const next = { ...current, [field]: value };

      if (field === "grade") {
        const nextClassOptions = getClassOptionsForGrade(value);
        if (nextClassOptions.length === 0) {
          next.classNumber = "";
        } else if (!nextClassOptions.includes(Number(next.classNumber))) {
          next.classNumber = nextClassOptions[0];
        }
      }

      return next;
    });
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
        grade: normalizeGradeForSubmit(form.grade),
        classNumber: normalizeClassNumberValue(form.grade, form.classNumber),
        password: form.password.trim()
      });
      setReservations((current) => [...current, reservation]);
      setMessage({ type: "success", text: "예약되었습니다." });
      setForm((current) => ({ ...current, password: "" }));
    } catch (error) {
      setMessage({
        type: "error",
        text: errorMessage(error, "예약을 저장하지 못했습니다.")
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(reservation) {
    const password = window.prompt(`${reservation.room} ${formatReservationOwner(reservation)} 예약의 삭제 비밀번호 또는 관리자 비밀번호를 입력해 주세요.`);

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
        text: errorMessage(error, "예약을 삭제하지 못했습니다.")
      });
    }
  }

  function reservationsFor(date, period) {
    return visibleReservations
      .filter((reservation) => reservation.date === date && reservation.period === period)
      .sort((a, b) => a.room.localeCompare(b.room, "ko-KR"));
  }

  function reservationsForDate(date) {
    return visibleReservations
      .filter((reservation) => reservation.date === date)
      .sort((a, b) => {
        if (a.period !== b.period) {
          return a.period - b.period;
        }

        return a.room.localeCompare(b.room, "ko-KR");
      });
  }

  function renderReservationItem(reservation) {
    return (
      <article className={`reservation-item ${ROOM_TONE_CLASSES[reservation.room] ?? ""}`} key={reservation.id}>
        <div>
          <strong>{reservation.room}</strong>
          <span>{formatReservationOwner(reservation)}</span>
        </div>
        <button
          type="button"
          className="delete-button"
          onClick={() => handleDelete(reservation)}
        >
          삭제
        </button>
      </article>
    );
  }

  const connectionLabel = {
    checking: "연결 확인 중",
    connected: "구글 시트 연결됨",
    error: "저장소 연결 오류"
  }[connectionStatus];

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
            <span className={`connection-badge ${connectionStatus}`}>{connectionLabel}</span>
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

              <div className="view-toggle" aria-label="보기 방식">
                <button
                  type="button"
                  className={viewMode === "table" ? "active" : ""}
                  onClick={() => setViewMode("table")}
                >
                  시간표
                </button>
                <button
                  type="button"
                  className={viewMode === "list" ? "active" : ""}
                  onClick={() => setViewMode("list")}
                >
                  날짜별
                </button>
              </div>

              <button type="button" className="ghost-button" onClick={loadReservations}>
                새로고침
              </button>
            </div>

            <div className={`schedule-scroll ${viewMode === "table" ? "" : "is-hidden"}`}>
              <table className="schedule-table">
                <thead>
                  <tr>
                    <th>교시</th>
                    {weekDays.map((day, index) => (
                      <th className={day.key === todayKey ? "today-cell" : ""} key={day.key}>
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
                          <td className={day.key === todayKey ? "today-cell" : ""} key={`${day.key}-${period}`}>
                            {loading ? (
                              <span className="muted">불러오는 중</span>
                            ) : dayReservations.length === 0 ? (
                              <span className="empty-slot">비어 있음</span>
                            ) : (
                              <div className="reservation-list">
                                {dayReservations.map(renderReservationItem)}
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

            <div className={`daily-list ${viewMode === "list" ? "" : "is-hidden"}`} aria-label="날짜별 예약 목록">
              {weekDays.map((day, index) => {
                const dayReservations = reservationsForDate(day.key);
                return (
                  <section className={`daily-column ${day.key === todayKey ? "today-card" : ""}`} key={day.key}>
                    <h3>
                      <span>{WEEKDAY_LABELS[index]}</span>
                      {day.label}
                    </h3>
                    {loading ? (
                      <span className="muted">불러오는 중</span>
                    ) : dayReservations.length === 0 ? (
                      <span className="empty-slot">예약 없음</span>
                    ) : (
                      <div className="reservation-list">
                        {dayReservations.map((reservation) => (
                          <div className="daily-reservation" key={reservation.id}>
                            <span>{reservation.period}교시</span>
                            {renderReservationItem(reservation)}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
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
                  min={dateRange.min}
                  max={dateRange.max}
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
                        {gradeLabel(grade)}
                      </option>
                    ))}
                  </select>
                </label>

                {isKindergarten ? null : (
                  <label>
                    반
                    <select value={form.classNumber} onChange={(event) => updateForm("classNumber", event.target.value)}>
                      {classOptions.map((classNumber) => (
                        <option key={classNumber} value={classNumber}>
                          {classNumber}반
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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
