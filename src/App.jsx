import { useEffect, useMemo, useState } from "react";
import {
  createReservationRangeAndConfirm,
  deleteReservationAndConfirm,
  deleteReservationsAndConfirm,
  fetchReservations
} from "./api.js";
import { GRADES, KINDERGARTEN_GRADE, PERIODS, ROOM_TONE_CLASSES, ROOMS, WEEKDAY_LABELS } from "./constants.js";
import { addWeeks, formatWeekRange, getStartOfWeek, getWeekDays, toDateKey } from "./dateUtils.js";
import { getPeriodRange, getPeriodRangeLabel } from "./periodRange.js";
import { formatReservationOwner } from "./reservationLabels.js";
import { getDuplicateReservationGroups, getDuplicateReservationsToDelete } from "./reservationCleanup.js";
import {
  formatSelectedReservationSummary,
  getSelectedReservations,
  validateSameDateSelection
} from "./selectionDelete.js";
import {
  getClassOptionsForGrade,
  getReservationDateRange,
  isKindergartenGrade,
  normalizeClassNumberValue,
  normalizeGradeValue
} from "./reservationRules.js";
import { findReservationRangeConflict, formatReservationConflictMessage } from "./reservationConflicts.js";

const initialForm = {
  date: toDateKey(new Date()),
  startPeriod: 1,
  endPeriod: 1,
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
  GOOGLE_SCRIPT_ERROR: "구글 시트 저장소 요청을 처리하지 못했습니다.",
  PERSISTENCE_UNCONFIRMED: "예약 저장을 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요.",
  DELETE_UNCONFIRMED: "예약 삭제를 확인하지 못했습니다. 저장소 배포 상태를 확인해 주세요."
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
  const [cleaningDuplicates, setCleaningDuplicates] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [selectedReservationIds, setSelectedReservationIds] = useState(() => new Set());
  const [connectionStatus, setConnectionStatus] = useState("checking");
  const [viewMode, setViewMode] = useState("table");

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const todayKey = useMemo(() => toDateKey(new Date()), []);
  const dateRange = useMemo(() => getReservationDateRange(new Date()), []);
  const classOptions = useMemo(() => getClassOptionsForGrade(form.grade), [form.grade]);
  const isKindergarten = isKindergartenGrade(form.grade);
  const duplicateGroups = useMemo(() => getDuplicateReservationGroups(reservations), [reservations]);
  const duplicateReservations = useMemo(() => getDuplicateReservationsToDelete(reservations), [reservations]);
  const selectedPeriods = useMemo(() => getPeriodRange(form.startPeriod, form.endPeriod), [form.startPeriod, form.endPeriod]);
  const selectedReservations = useMemo(() => {
    return getSelectedReservations(reservations, selectedReservationIds);
  }, [reservations, selectedReservationIds]);

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

  useEffect(() => {
    setSelectedReservationIds((current) => {
      const existingIds = new Set(reservations.map((reservation) => reservation.id));
      const next = new Set([...current].filter((id) => existingIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [reservations]);

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

      if (field === "startPeriod" && Number(next.endPeriod) < Number(value)) {
        next.endPeriod = Number(value);
      }

      if (field === "endPeriod" && Number(value) < Number(next.startPeriod)) {
        next.startPeriod = Number(value);
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
      const reservationInput = {
        ...form,
        startPeriod: Number(form.startPeriod),
        endPeriod: Number(form.endPeriod),
        grade: normalizeGradeForSubmit(form.grade),
        classNumber: normalizeClassNumberValue(form.grade, form.classNumber),
        password: form.password.trim()
      };
      const conflict = findReservationRangeConflict(reservations, reservationInput);

      if (conflict) {
        setMessage({ type: "error", text: formatReservationConflictMessage(conflict) });
        return;
      }

      const result = await createReservationRangeAndConfirm(reservationInput);
      setReservations(result.reservations);
      setMessage({ type: "success", text: `${getPeriodRangeLabel(selectedPeriods)} 예약되었습니다.` });
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
      const result = await deleteReservationAndConfirm(reservation.id, password);
      setReservations(result.reservations);
      setMessage({ type: "success", text: "예약을 삭제했습니다." });
    } catch (error) {
      setMessage({
        type: "error",
        text: errorMessage(error, "예약을 삭제하지 못했습니다.")
      });
    }
  }

  async function handleDeleteSelected() {
    try {
      validateSameDateSelection(selectedReservations);
    } catch (error) {
      setMessage({
        type: "error",
        text: errorMessage(error, "삭제할 예약을 선택해 주세요.")
      });
      return;
    }

    const summary = formatSelectedReservationSummary(selectedReservations);
    const password = window.prompt(`${summary} 삭제 비밀번호 또는 관리자 비밀번호를 입력해 주세요.`);

    if (!password) {
      return;
    }

    const shouldDelete = window.confirm(`${summary}을 삭제할까요?`);

    if (!shouldDelete) {
      return;
    }

    setDeletingSelected(true);
    try {
      const ids = selectedReservations.map((reservation) => reservation.id);
      const result = await deleteReservationsAndConfirm(ids, password);
      setReservations(result.reservations);
      setSelectedReservationIds(new Set());
      setMessage({ type: "success", text: `선택한 예약 ${result.deletedCount}건을 삭제했습니다.` });
    } catch (error) {
      setMessage({
        type: "error",
        text: errorMessage(error, "선택한 예약을 삭제하지 못했습니다.")
      });
    } finally {
      setDeletingSelected(false);
    }
  }

  function toggleReservationSelection(reservationId) {
    setSelectedReservationIds((current) => {
      const next = new Set(current);

      if (next.has(reservationId)) {
        next.delete(reservationId);
      } else {
        next.add(reservationId);
      }

      return next;
    });
  }

  async function handleCleanupDuplicates() {
    if (duplicateReservations.length === 0) {
      setMessage({ type: "success", text: "정리할 중복 예약이 없습니다." });
      return;
    }

    const password = window.prompt("중복 예약 삭제를 위한 관리자 비밀번호를 입력해 주세요.");

    if (!password) {
      return;
    }

    const shouldDelete = window.confirm(`먼저 예약한 것만 남기고 중복 예약 ${duplicateReservations.length}건을 삭제할까요?`);

    if (!shouldDelete) {
      return;
    }

    setCleaningDuplicates(true);
    try {
      let latestReservations = reservations;

      for (const reservation of duplicateReservations) {
        const result = await deleteReservationAndConfirm(reservation.id, password);
        latestReservations = result.reservations;
      }

      setReservations(latestReservations);
      setMessage({ type: "success", text: `중복 예약 ${duplicateReservations.length}건을 정리했습니다.` });
    } catch (error) {
      setMessage({
        type: "error",
        text: errorMessage(error, "중복 예약을 정리하지 못했습니다.")
      });
    } finally {
      setCleaningDuplicates(false);
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
    const owner = formatReservationOwner(reservation);
    const checked = selectedReservationIds.has(reservation.id);

    return (
      <article className={`reservation-item ${ROOM_TONE_CLASSES[reservation.room] ?? ""}`} key={reservation.id}>
        <label className="select-reservation">
          <input
            type="checkbox"
            checked={checked}
            aria-label={`${reservation.room} ${owner} ${reservation.period}교시 선택`}
            onChange={() => toggleReservationSelection(reservation.id)}
          />
        </label>
        <div>
          <strong>{reservation.room}</strong>
          <span>{owner}</span>
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

              <div className="selection-actions" aria-label="선택 삭제">
                <span>선택 {selectedReservations.length}건</span>
                <button
                  type="button"
                  className="delete-selected-button"
                  disabled={deletingSelected || selectedReservations.length === 0}
                  onClick={handleDeleteSelected}
                >
                  {deletingSelected ? "삭제 중" : "선택 삭제"}
                </button>
                <button
                  type="button"
                  className="ghost-button compact"
                  disabled={selectedReservations.length === 0}
                  onClick={() => setSelectedReservationIds(new Set())}
                >
                  선택 해제
                </button>
              </div>
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
                  시작 교시
                  <select value={form.startPeriod} onChange={(event) => updateForm("startPeriod", event.target.value)}>
                    {PERIODS.map((period) => (
                      <option key={period} value={period}>
                        {period}교시
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  끝 교시
                  <select value={form.endPeriod} onChange={(event) => updateForm("endPeriod", event.target.value)}>
                    {PERIODS.filter((period) => period >= Number(form.startPeriod)).map((period) => (
                      <option key={period} value={period}>
                        {period}교시
                      </option>
                    ))}
                  </select>
                </label>
              </div>

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

            <section className="admin-panel" aria-label="중복 예약 정리">
              <div>
                <p className="eyebrow">관리 도구</p>
                <h2>중복 정리</h2>
              </div>

              {duplicateGroups.length === 0 ? (
                <p className="duplicate-summary">중복 예약 없음</p>
              ) : (
                <div className="duplicate-summary warning">
                  <strong>중복 {duplicateGroups.length}묶음</strong>
                  <span>삭제 후보 {duplicateReservations.length}건</span>
                  <span>
                    첫 예약만 남기고 나머지를 삭제합니다.
                  </span>
                </div>
              )}

              <button
                type="button"
                className="cleanup-button"
                disabled={cleaningDuplicates || duplicateReservations.length === 0}
                onClick={handleCleanupDuplicates}
              >
                {cleaningDuplicates ? "정리 중" : "중복 정리"}
              </button>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
