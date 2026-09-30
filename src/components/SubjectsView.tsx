"use client";
import { useEffect, useId, useRef, useState } from "react";
import { DateTime } from "luxon";
import { localizedText, type Locale } from "@/lib/i18n";
import { ZONE } from "@/lib/calendar";
import type { Me } from "@/lib/types";
import {
  taskStatuses,
  type BoardAction,
  type SubjectBoard,
  type SubjectSummary,
  type SubjectTask,
  type TaskData,
  type TaskStatus,
} from "@/lib/subject-board";
import { subjectCopy } from "@/lib/subject-copy";
import DetailModal from "./DetailModal";
import Icon from "./Icon";
import s from "./SubjectsView.module.css";

async function request(path: string, init?: RequestInit) {
  const response = await fetch(path, {
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
    ...init,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "unavailable");
  return data;
}

export default function SubjectsView({
  me,
  locale,
  onDirty,
  sourceRevision,
}: {
  me: Me;
  locale: Locale;
  onDirty: (dirty: boolean) => void;
  sourceRevision: string;
}) {
  const t = subjectCopy[locale];
  const [subjects, setSubjects] = useState<SubjectSummary[] | null>(null);
  const [course, setCourse] = useState("");
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [dirty, setDirty] = useState(false);
  const selection = useRef({ course, dirty, subjects });
  selection.current = { course, dirty, subjects };
  useEffect(() => {
    let active = true;
    setFailed(false);
    request(`/api/subjects?semester=${me.semester}`)
      .then((data) => {
        if (!active) return;
        const next: SubjectSummary[] = data.subjects;
        const previous = selection.current;
        const unsaved =
          previous.dirty &&
          previous.subjects?.find(
            (subject) => subject.course === previous.course,
          );
        if (
          unsaved &&
          !next.some((subject) => subject.course === unsaved.course)
        )
          next.push(unsaved);
        setSubjects(next);
        const wanted = new URLSearchParams(location.search).get("course");
        setCourse((current) =>
          next.some((subject) => subject.course === current)
            ? current
            : next.find((s: SubjectSummary) => s.course === wanted)?.course ||
              next[0]?.course ||
              "",
        );
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [me.semester, attempt, sourceRevision]);
  useEffect(() => {
    onDirty(dirty);
    return () => onDirty(false);
  }, [dirty, onDirty]);
  const selected = subjects?.find((subject) => subject.course === course);
  return (
    <div className={s.workspace}>
      <p className={s.muted}>{t.intro}</p>
      {failed && (
        <div role="alert">
          <p>{t.loadFailed}</p>
          <button
            className={s.secondary}
            onClick={() => setAttempt(attempt + 1)}
          >
            {t.retry}
          </button>
        </div>
      )}
      {subjects === null ? (
        !failed && <p role="status">{t.loading}</p>
      ) : !subjects.length ? (
        <p className={s.empty}>{t.empty}</p>
      ) : (
        <>
          <label className={s.subjectPicker}>
            {t.subject}
            <select
              aria-label={t.subject}
              value={course}
              onChange={(event) => {
                if (dirty && !confirm(t.discard)) return;
                setCourse(event.target.value);
                const url = new URL(location.href);
                url.searchParams.set("course", event.target.value);
                history.replaceState(null, "", url.pathname + url.search);
              }}
            >
              {subjects.map((subject) => (
                <option key={subject.course} value={subject.course}>
                  {subject.course} · {localizedText(subject.title, locale)}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <SubjectBoardView
              key={`${me.id}:${me.semester}:${course}`}
              me={me}
              subject={selected}
              locale={locale}
              onDirty={setDirty}
            />
          )}
        </>
      )}
    </div>
  );
}

function SubjectBoardView({
  me,
  subject,
  locale,
  onDirty,
}: {
  me: Me;
  subject: SubjectSummary;
  locale: Locale;
  onDirty: (dirty: boolean) => void;
}) {
  const t = subjectCopy[locale];
  const notesId = useId();
  const [board, setBoard] = useState<SubjectBoard | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<{
    task?: SubjectTask;
    status: TaskStatus;
  } | null>(null);
  const dragging = useRef<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const dirty = !!board && (notes !== board.notes || editing !== null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    onDirty(dirty || busy);
    return () => onDirty(false);
  }, [dirty, busy, onDirty]);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty || busy) event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  useEffect(() => {
    let active = true;
    setError("");
    request(
      `/api/subjects?${new URLSearchParams({ semester: me.semester, course: subject.course })}`,
    )
      .then(({ board }) => {
        if (active) {
          setBoard(board);
          setNotes(board.notes);
        }
      })
      .catch(() => {
        if (active) setError("load");
      });
    return () => {
      active = false;
    };
  }, [me.semester, subject.course, attempt]);
  async function change(change: BoardAction) {
    if (!board || pending.current) return false;
    pending.current = true;
    setBusy(true);
    setError("");
    setSaved(false);
    if (change.action === "check") {
      setBoard({
        ...board,
        tasks: board.tasks.map((task) =>
          task.id === change.id
            ? {
                ...task,
                checklist: task.checklist.map((item) =>
                  item.id === change.itemId
                    ? { ...item, done: change.done }
                    : item,
                ),
              }
            : task,
        ),
      });
    }
    try {
      const result = await request("/api/subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": me.csrf,
        },
        body: JSON.stringify({
          semester: me.semester,
          course: subject.course,
          revision: board.revision,
          change,
        }),
      });
      if (mounted.current) {
        setBoard(result.board);
        setSaved(true);
      }
      return true;
    } catch (error) {
      if (mounted.current) {
        setBoard(board);
        setError(error instanceof Error ? error.message : "unavailable");
      }
      return false;
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  const errorMessage =
    error === "board_conflict"
      ? t.conflict
      : error === "board_full"
        ? t.full
        : error === "load"
          ? t.loadFailed
          : t.failed;
  const notice = error ? (
    <div role="alert" className={s.error}>
      <p>{errorMessage}</p>
      {(error === "board_conflict" || error === "load") && (
        <button
          className={s.secondary}
          onClick={() => {
            if (dirty && !confirm(t.discard)) return;
            setEditing(null);
            setBoard(null);
            setSaved(false);
            setAttempt(attempt + 1);
          }}
        >
          {error === "load" ? t.retry : t.reload}
        </button>
      )}
    </div>
  ) : null;
  if (!board) return notice || <p role="status">{t.loading}</p>;
  const drop = (status: TaskStatus, beforeId?: string) => {
    const id = dragging.current;
    dragging.current = null;
    if (id && id !== beforeId && !busy)
      void change({ action: "move", id, status, beforeId });
  };
  return (
    <>
      <header className={s.boardHeader}>
        <div>
          <h2>{subject.course}</h2>
          <p>{localizedText(subject.title, locale)}</p>
        </div>
        <span className={s.saveStatus} role="status">
          {busy
            ? t.saving
            : notes !== board.notes
              ? t.unsaved
              : saved
                ? t.saved
                : ""}
        </span>
      </header>
      <p className={s.privacy}>{t.private}</p>
      {!editing && notice}
      <section className={s.notes} aria-labelledby={notesId}>
        <h3 id={notesId}>{t.notes}</h3>
        <textarea
          aria-label={t.notes}
          value={notes}
          maxLength={8000}
          rows={4}
          placeholder={t.notesHint}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className={s.notesFooter}>
          <span className={s.muted}>{notes.length} / 8000</span>
          <button
            className={s.primary}
            disabled={busy || notes === board.notes}
            onClick={() => void change({ action: "notes", notes })}
          >
            {t.saveNotes}
          </button>
        </div>
      </section>
      <div className={s.tasksHeading}>
        <h3>{t.tasks}</h3>
        <p className={s.muted}>{t.boardHint}</p>
      </div>
      <div className={s.columns}>
        {taskStatuses.map((status) => {
          const tasks = board.tasks.filter((task) => task.status === status);
          return (
            <section
              key={status}
              className={s.column}
              data-status={status}
              aria-label={t[status]}
              onDragOver={(event) => {
                if (dragging.current) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                drop(status);
              }}
            >
              <header className={s.columnHeader}>
                <h4>{t[status]}</h4>
                <span>{tasks.length}</span>
              </header>
              <div className={s.cards}>
                {tasks.map((task, index) => (
                  <article
                    key={task.id}
                    className={s.card}
                    aria-label={task.title}
                    draggable={!busy}
                    onDragStart={(event) => {
                      dragging.current = task.id;
                      event.dataTransfer.setData("text/plain", task.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      dragging.current = null;
                    }}
                    onDragOver={(event) => {
                      if (dragging.current) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      drop(status, task.id);
                    }}
                  >
                    <button
                      className={s.cardTitle}
                      onClick={() => {
                        setError("");
                        setEditing({ task, status });
                      }}
                      aria-label={`${t.edit}: ${task.title}`}
                      disabled={busy}
                    >
                      {task.title}
                    </button>
                    {task.description && (
                      <p className={s.description}>{task.description}</p>
                    )}
                    {task.dueDate && (
                      <p
                        className={s.due}
                        data-overdue={
                          status !== "done" &&
                          task.dueDate <
                            DateTime.now().setZone(ZONE).toISODate()!
                        }
                      >
                        {status !== "done" &&
                        task.dueDate < DateTime.now().setZone(ZONE).toISODate()!
                          ? `${t.overdue} · `
                          : ""}
                        <time dateTime={task.dueDate}>
                          {DateTime.fromISO(task.dueDate)
                            .setLocale(locale)
                            .toLocaleString(DateTime.DATE_MED)}
                        </time>
                      </p>
                    )}
                    {!!task.checklist.length && (
                      <div className={s.checklist}>
                        <span className={s.muted}>
                          {t.checklist} ·{" "}
                          {task.checklist.filter((item) => item.done).length}/
                          {task.checklist.length}
                        </span>
                        {task.checklist.map((item) => (
                          <label key={item.id} className={s.checkItem}>
                            <input
                              type="checkbox"
                              checked={item.done}
                              disabled={busy}
                              onChange={(e) =>
                                void change({
                                  action: "check",
                                  id: task.id,
                                  itemId: item.id,
                                  done: e.target.checked,
                                })
                              }
                            />
                            <span className={item.done ? s.checked : ""}>
                              {item.text}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className={s.cardActions}>
                      <select
                        aria-label={`${t.move}: ${task.title}`}
                        value={status}
                        disabled={busy}
                        onChange={(e) =>
                          void change({
                            action: "move",
                            id: task.id,
                            status: e.target.value as TaskStatus,
                          })
                        }
                      >
                        {taskStatuses.map((value) => (
                          <option key={value} value={value}>
                            {t[value]}
                          </option>
                        ))}
                      </select>
                      <button
                        className={s.iconButton}
                        disabled={busy || index === 0}
                        title={t.moveUp}
                        aria-label={`${t.moveUp}: ${task.title}`}
                        onClick={() =>
                          void change({
                            action: "move",
                            id: task.id,
                            status,
                            beforeId: tasks[index - 1].id,
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        className={s.iconButton}
                        disabled={busy}
                        title={t.delete}
                        aria-label={`${t.delete}: ${task.title}`}
                        onClick={() => {
                          if (confirm(t.deleteConfirm))
                            void change({ action: "delete", id: task.id });
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </article>
                ))}
                {!tasks.length && <p className={s.columnEmpty}>{t.noTasks}</p>}
              </div>
              <button
                className={s.addTask}
                disabled={busy || board.tasks.length >= 100}
                onClick={() => {
                  setError("");
                  setEditing({ status });
                }}
              >
                <Icon name="plus" />
                {t.add}
              </button>
            </section>
          );
        })}
      </div>
      {editing && (
        <TaskEditor
          task={editing.task}
          locale={locale}
          busy={busy}
          notice={notice}
          close={() => {
            if (!busy) {
              setEditing(null);
              setError("");
            }
          }}
          save={async (task) => {
            const ok = await change(
              editing.task
                ? { action: "edit", id: editing.task.id, task }
                : { action: "add", status: editing.status, task },
            );
            if (ok) setEditing(null);
          }}
        />
      )}
    </>
  );
}

function TaskEditor({
  task,
  locale,
  busy,
  notice,
  save,
  close,
}: {
  task?: SubjectTask;
  locale: Locale;
  busy: boolean;
  notice: React.ReactNode;
  save: (task: TaskData) => Promise<void>;
  close: () => void;
}) {
  const t = subjectCopy[locale];
  const initial: TaskData = task
    ? {
        title: task.title,
        description: task.description,
        dueDate: task.dueDate,
        checklist: task.checklist,
      }
    : { title: "", description: "", dueDate: null, checklist: [] };
  const [data, setData] = useState<TaskData>(initial);
  const canClose = () =>
    !busy &&
    (JSON.stringify(data) === JSON.stringify(initial) || confirm(t.discard));
  const dismiss = () => {
    if (canClose()) close();
  };
  return (
    <DetailModal
      title={task ? t.edit : t.add}
      locale={locale}
      close={close}
      canClose={canClose}
      className={s.editor}
    >
      <form
        className={s.form}
        onSubmit={(event) => {
          event.preventDefault();
          void save({
            ...data,
            checklist: data.checklist.filter((item) => item.text.trim()),
          });
        }}
      >
        <fieldset disabled={busy}>
          <label>
            {t.title}
            <input
              required
              maxLength={160}
              value={data.title}
              onChange={(e) => setData({ ...data, title: e.target.value })}
            />
          </label>
          <label>
            {t.description}
            <textarea
              rows={4}
              maxLength={2000}
              value={data.description}
              onChange={(e) =>
                setData({ ...data, description: e.target.value })
              }
            />
          </label>
          <label>
            {t.due}
            <input
              type="date"
              value={data.dueDate || ""}
              onChange={(e) =>
                setData({ ...data, dueDate: e.target.value || null })
              }
            />
          </label>
          <div className={s.editChecklist}>
            <h3>{t.checklist}</h3>
            {data.checklist.map((item, index) => (
              <div className={s.checkEditRow} key={item.id}>
                <input
                  aria-label={`${t.item} ${index + 1}`}
                  maxLength={160}
                  value={item.text}
                  onChange={(e) =>
                    setData({
                      ...data,
                      checklist: data.checklist.map((value) =>
                        value.id === item.id
                          ? { ...value, text: e.target.value }
                          : value,
                      ),
                    })
                  }
                />
                <button
                  type="button"
                  className={s.iconButton}
                  aria-label={`${t.removeItem} ${index + 1}`}
                  onClick={() =>
                    setData({
                      ...data,
                      checklist: data.checklist.filter(
                        (value) => value.id !== item.id,
                      ),
                    })
                  }
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className={s.secondary}
              type="button"
              disabled={data.checklist.length >= 30}
              onClick={() =>
                setData({
                  ...data,
                  checklist: [
                    ...data.checklist,
                    { id: crypto.randomUUID(), text: "", done: false },
                  ],
                })
              }
            >
              {t.addItem}
            </button>
          </div>
        </fieldset>
        {notice}
        <div className={s.formActions}>
          <button
            type="button"
            className={s.secondary}
            disabled={busy}
            onClick={dismiss}
          >
            {t.cancel}
          </button>
          <button className={s.primary} disabled={busy || !data.title.trim()}>
            {busy ? t.saving : t.save}
          </button>
        </div>
      </form>
    </DetailModal>
  );
}
