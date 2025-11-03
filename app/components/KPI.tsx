"use client";
import React, { useEffect, useState } from "react";

// ClassRoutineApp — interactive Next.js React component
// Updated: users can provide explicit lab names and classroom names (comma-separated) or provide counts.
// Features:
// - Add technologies with either a list of room names or counts for theory/lab rooms
// - Add teachers with id, name, max hours and multiple subjects (id|Title|hours|type)
// - Subjects added through teacher entry are registered at technology level
// - Scheduler (greedy) creates a weekly timetable respecting theory/lab room types
// - Reports: Master, per-technology, per-teacher, per-room (lab/classroom)
// - Printable report

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PERIODS_PER_DAY = 6;

function createEmptyMatrix() {
  return Array(DAYS.length * PERIODS_PER_DAY).fill(null);
}

export default function ClassRoutineApp() {
  const [technologies, setTechnologies] = useState([]);
  const [timetable, setTimetable] = useState(null);
  const [selectedReport, setSelectedReport] = useState("master");
  const [generatedAt, setGeneratedAt] = useState(null);

  // Tech form
  const [newTechCode, setNewTechCode] = useState("");
  const [newTechName, setNewTechName] = useState("");
  const [theoryCount, setTheoryCount] = useState(2);
  const [labCount, setLabCount] = useState(1);
  // optional explicit names (comma-separated) — if provided, those names are used instead of auto-generated names
  const [theoryNamesInput, setTheoryNamesInput] = useState("");
  const [labNamesInput, setLabNamesInput] = useState("");

  // Teacher form
  const [teacherFormTech, setTeacherFormTech] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [teacherName, setTeacherName] = useState("");
  const [teacherMaxHours, setTeacherMaxHours] = useState(10);
  const [subjectInput, setSubjectInput] = useState("");
  const [teacherSubjects, setTeacherSubjects] = useState([]);

  useEffect(() => {
    if (technologies.length === 0) {
      setTechnologies([
        {
          id: "CS",
          name: "Computer Science",
          rooms: { theory: ["CS-T1", "CS-T2"], lab: ["CS-L1"] },
          subjects: [],
          teachers: [],
        },
        {
          id: "EE",
          name: "Electrical Eng",
          rooms: { theory: ["EE-T1"], lab: ["EE-L1", "EE-L2"] },
          subjects: [],
          teachers: [],
        },
      ]);
    }
  }, []);

  // parse comma-separated input into trimmed non-empty array
  const parseNames = (input) =>
    input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const addTechnology = () => {
    if (!newTechCode || !newTechName)
      return alert("Provide technology code and name.");

    if (technologies.find((t) => t.id === newTechCode))
      return alert("Technology code exists.");

    let theoryRooms = [];
    let labRooms = [];

    const explicitTheory = parseNames(theoryNamesInput);
    const explicitLab = parseNames(labNamesInput);

    if (explicitTheory.length > 0) theoryRooms = explicitTheory;
    else
      for (let i = 1; i <= Number(theoryCount); i++)
        theoryRooms.push(`${newTechCode}-T${i}`);

    if (explicitLab.length > 0) labRooms = explicitLab;
    else
      for (let i = 1; i <= Number(labCount); i++)
        labRooms.push(`${newTechCode}-L${i}`);

    const tech = {
      id: newTechCode,
      name: newTechName,
      rooms: { theory: theoryRooms, lab: labRooms },
      subjects: [],
      teachers: [],
    };

    setTechnologies((s) => [...s, tech]);
    setNewTechCode("");
    setNewTechName("");
    setTheoryNamesInput("");
    setLabNamesInput("");
    setTheoryCount(2);
    setLabCount(1);
  };

  const addSubjectToTeacherForm = () => {
    // format id|Title|hours|type
    const parts = subjectInput.split("|").map((p) => p.trim());
    if (parts.length !== 4) return alert("Subject format: id|Title|hours|type");
    const [id, title, hoursStr, type] = parts;
    const hours = Number(hoursStr);
    if (!id || !title || !hours || !["theory", "lab"].includes(type))
      return alert("Invalid subject fields.");
    setTeacherSubjects((s) => [...s, { id, title, hours, type }]);
    setSubjectInput("");
  };

  const clearTeacherForm = () => {
    setTeacherId("");
    setTeacherName("");
    setTeacherMaxHours(10);
    setTeacherSubjects([]);
    setTeacherFormTech("");
  };

  const addTeacher = () => {
    if (!teacherFormTech) return alert("Select technology for teacher.");
    if (!teacherId || !teacherName)
      return alert("Provide teacher id and name.");

    const techIndex = technologies.findIndex((t) => t.id === teacherFormTech);
    if (techIndex === -1) return alert("Technology not found.");

    const tech = { ...technologies[techIndex] };

    // register subjects at technology level if not present
    teacherSubjects.forEach((s) => {
      if (!tech.subjects.find((ss) => ss.id === s.id))
        tech.subjects.push({ ...s });
    });

    // add teacher
    tech.teachers.push({
      id: teacherId,
      name: teacherName,
      maxHours: Number(teacherMaxHours),
      canDo: teacherSubjects.map((s) => s.id),
    });

    const newTechs = [...technologies];
    newTechs[techIndex] = tech;
    setTechnologies(newTechs);

    clearTeacherForm();
  };

  const generateTimetable = () => {
    const master = {
      rooms: {},
      teachers: {},
      techs: {},
      slots: Array(DAYS.length * PERIODS_PER_DAY).fill(null),
    };

    technologies.forEach((tech) => {
      master.techs[tech.id] = createEmptyMatrix();
      Object.values(tech.rooms)
        .flat()
        .forEach((r) => (master.rooms[r] = createEmptyMatrix()));
      (tech.teachers || []).forEach(
        (t) => (master.teachers[t.id] = createEmptyMatrix())
      );
    });

    // build subject queue
    const subjectQueue = [];
    technologies.forEach((tech) =>
      tech.subjects.forEach((s) =>
        subjectQueue.push({ techId: tech.id, subject: s, remaining: s.hours })
      )
    );

    const findTeacherFor = (techId, subjectId) => {
      const tech = technologies.find((t) => t.id === techId);
      if (!tech) return null;
      // simple heuristic: find teacher who can teach and has capacity
      for (const c of tech.teachers) {
        const assigned = master.teachers[c.id].filter(Boolean).length;
        if (c.canDo.includes(subjectId) && assigned < c.maxHours) return c;
      }
      return null;
    };

    const findAvailableRoom = (techId, kind, slot) => {
      const tech = technologies.find((t) => t.id === techId);
      if (!tech) return null;
      const rooms = tech.rooms[kind] || [];
      for (const r of rooms) if (!master.rooms[r][slot]) return r;
      return null;
    };

    let progress = true;
    const totalSlots = DAYS.length * PERIODS_PER_DAY;
    while (progress) {
      progress = false;
      for (const item of subjectQueue) {
        if (item.remaining <= 0) continue;
        for (let slot = 0; slot < totalSlots; slot++) {
          if (master.slots[slot]) continue;
          const kind = item.subject.type === "lab" ? "lab" : "theory";
          const room = findAvailableRoom(item.techId, kind, slot);
          if (!room) continue;
          const teacher = findTeacherFor(item.techId, item.subject.id);
          if (!teacher) continue;
          if (master.teachers[teacher.id][slot]) continue;

          const entry = {
            techId: item.techId,
            subjectId: item.subject.id,
            title: item.subject.title,
            teacherId: teacher.id,
            teacherName: teacher.name,
            room,
            kind,
            day: Math.floor(slot / PERIODS_PER_DAY),
            period: (slot % PERIODS_PER_DAY) + 1,
            slot,
          };

          master.slots[slot] = entry;
          master.rooms[room][slot] = entry;
          master.teachers[teacher.id][slot] = entry;
          master.techs[item.techId][slot] = entry;

          item.remaining -= 1;
          progress = true;
          break;
        }
      }
    }

    setTimetable(master);
    setGeneratedAt(new Date().toISOString());
  };

  const renderMatrixTable = (matrix, title) => (
    <div className="overflow-auto mt-4 border rounded p-2">
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <table className="min-w-full table-auto border-collapse">
        <thead>
          <tr>
            <th className="border px-2 py-1">Day/Period</th>
            {Array.from({ length: PERIODS_PER_DAY }).map((_, p) => (
              <th key={p} className="border px-2 py-1">
                P{p + 1}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {DAYS.map((d, di) => (
            <tr key={d}>
              <td className="border px-2 py-1 font-medium">{d}</td>
              {Array.from({ length: PERIODS_PER_DAY }).map((_, pi) => {
                const slot = di * PERIODS_PER_DAY + pi;
                const cell = matrix ? matrix[slot] : null;
                return (
                  <td key={pi} className="border px-2 py-1 align-top h-20">
                    {cell ? (
                      <div>
                        <div className="font-semibold">{cell.title}</div>
                        <div className="text-sm">
                          {cell.teacherName} • {cell.room}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-gray-500">—</div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderTeacherReport = (teacherId) => {
    if (!timetable) return null;
    const matrix = timetable.teachers[teacherId];
    const teacher = technologies
      .flatMap((t) => t.teachers || [])
      .find((tt) => tt.id === teacherId);
    return renderMatrixTable(matrix, `Routine — ${teacher?.name || teacherId}`);
  };

  const renderTechReport = (techId) => {
    if (!timetable) return null;
    const matrix = timetable.techs[techId];
    const tech = technologies.find((t) => t.id === techId);
    return (
      <div>
        <h2 className="text-xl font-bold">{tech?.name} — Routine</h2>
        {renderMatrixTable(matrix, `${tech?.name} Routine`)}
      </div>
    );
  };

  const renderRoomReport = (roomId) => {
    if (!timetable) return null;
    const matrix = timetable.rooms[roomId];
    return renderMatrixTable(matrix, `Room: ${roomId}`);
  };

  const handlePrint = () => window.print();

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">
          Class Routine Generator (Interactive)
        </h1>
        <div className="space-x-2">
          <button
            className="px-3 py-2 rounded bg-blue-600 text-white"
            onClick={generateTimetable}
          >
            Generate Routine
          </button>
          <button
            className="px-3 py-2 rounded bg-green-600 text-white"
            onClick={handlePrint}
          >
            Print Report
          </button>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="col-span-1 bg-white p-4 rounded shadow">
          <h2 className="font-semibold mb-2">Create Technology</h2>
          <input
            className="w-full mb-2 p-2 border rounded"
            placeholder="Code (e.g. CS)"
            value={newTechCode}
            onChange={(e) => setNewTechCode(e.target.value)}
          />
          <input
            className="w-full mb-2 p-2 border rounded"
            placeholder="Name (Computer Science)"
            value={newTechName}
            onChange={(e) => setNewTechName(e.target.value)}
          />

          <div className="mb-2">
            <label className="block text-sm font-medium">
              Option A — provide explicit room names (comma-separated)
            </label>
            <input
              className="w-full mb-2 p-2 border rounded"
              placeholder="Theory rooms e.g. CS-T1, CS-T2"
              value={theoryNamesInput}
              onChange={(e) => setTheoryNamesInput(e.target.value)}
            />
            <input
              className="w-full mb-2 p-2 border rounded"
              placeholder="Lab rooms e.g. CS-L1, CS-L2"
              value={labNamesInput}
              onChange={(e) => setLabNamesInput(e.target.value)}
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium">
              Option B — auto-generate names by counts
            </label>
            <div className="flex gap-2">
              <input
                type="number"
                className="w-1/2 p-2 border rounded"
                value={theoryCount}
                onChange={(e) => setTheoryCount(e.target.value)}
              />
              <input
                type="number"
                className="w-1/2 p-2 border rounded"
                value={labCount}
                onChange={(e) => setLabCount(e.target.value)}
              />
            </div>
          </div>

          <button
            className="px-3 py-2 rounded bg-indigo-600 text-white"
            onClick={addTechnology}
          >
            Add Technology
          </button>

          <hr className="my-4" />

          <h2 className="font-semibold mb-2">Add Teacher</h2>
          <select
            className="w-full p-2 border rounded mb-2"
            value={teacherFormTech}
            onChange={(e) => setTeacherFormTech(e.target.value)}
          >
            <option value="">-- select technology --</option>
            {technologies.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          <input
            className="w-full mb-2 p-2 border rounded"
            placeholder="Teacher ID (e.g. t1)"
            value={teacherId}
            onChange={(e) => setTeacherId(e.target.value)}
          />
          <input
            className="w-full mb-2 p-2 border rounded"
            placeholder="Teacher Name"
            value={teacherName}
            onChange={(e) => setTeacherName(e.target.value)}
          />
          <input
            className="w-full mb-2 p-2 border rounded"
            placeholder="Max Hours / week"
            type="number"
            value={teacherMaxHours}
            onChange={(e) => setTeacherMaxHours(e.target.value)}
          />

          <div className="mb-2">
            <label className="block text-sm">
              Add Subject to this teacher (format: id|Title|hours|type)
            </label>
            <input
              className="w-full mb-2 p-2 border rounded"
              placeholder="cs101|Programming I|4|theory"
              value={subjectInput}
              onChange={(e) => setSubjectInput(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="px-3 py-2 rounded bg-gray-200"
                onClick={addSubjectToTeacherForm}
              >
                Add Subject
              </button>
              <button
                className="px-3 py-2 rounded bg-red-200"
                onClick={() => setTeacherSubjects([])}
              >
                Clear Subjects
              </button>
            </div>
            <div className="mt-2 text-sm">Subjects added:</div>
            <ul className="list-disc ml-6 text-sm">
              {teacherSubjects.map((s, i) => (
                <li key={i}>
                  {s.id} — {s.title} ({s.hours}h) [{s.type}]
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-2">
            <button
              className="px-3 py-2 rounded bg-teal-600 text-white mr-2"
              onClick={addTeacher}
            >
              Add Teacher
            </button>
            <button
              className="px-3 py-2 rounded bg-gray-300"
              onClick={clearTeacherForm}
            >
              Reset
            </button>
          </div>

          <hr className="my-4" />

          <h3 className="font-semibold">Existing Technologies</h3>
          <ul className="text-sm list-disc ml-6">
            {technologies.map((t) => (
              <li key={t.id}>
                {t.name} — Theory: {t.rooms.theory.length}, Labs:{" "}
                {t.rooms.lab.length}, Teachers: {t.teachers.length}, Subjects:{" "}
                {t.subjects.length}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="col-span-2 bg-white p-4 rounded shadow"
          id="printable-report"
        >
          <div className="flex items-center justify-between">
            <div>
              <label className="mr-2">
                <input
                  type="radio"
                  name="report"
                  checked={selectedReport === "master"}
                  onChange={() => setSelectedReport("master")}
                />{" "}
                Master
              </label>
              <label className="mr-2">
                <input
                  type="radio"
                  name="report"
                  checked={selectedReport === "tech"}
                  onChange={() => setSelectedReport("tech")}
                />{" "}
                Technology
              </label>
              <label className="mr-2">
                <input
                  type="radio"
                  name="report"
                  checked={selectedReport === "teacher"}
                  onChange={() => setSelectedReport("teacher")}
                />{" "}
                Teacher
              </label>
              <label className="mr-2">
                <input
                  type="radio"
                  name="report"
                  checked={selectedReport === "room"}
                  onChange={() => setSelectedReport("room")}
                />{" "}
                Room
              </label>
            </div>
            <div className="text-sm text-gray-600">
              Generated: {generatedAt || "-"}
            </div>
          </div>

          <div className="mt-4">
            {(() => {
              if (!timetable)
                return (
                  <div className="text-gray-500">
                    No timetable generated yet. Click "Generate Routine".
                  </div>
                );

              if (selectedReport === "master")
                return renderMatrixTable(timetable.slots, "Master Routine");

              if (selectedReport === "tech")
                return (
                  <div>
                    <select
                      className="mb-2 p-2 border rounded"
                      onChange={(e) =>
                        setSelectedReport(`tech:${e.target.value}`)
                      }
                    >
                      <option value="">-- choose technology --</option>
                      {technologies.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    {selectedReport.startsWith("tech:")
                      ? renderTechReport(selectedReport.split(":")[1])
                      : null}
                  </div>
                );

              if (selectedReport === "teacher")
                return (
                  <div>
                    <select
                      className="mb-2 p-2 border rounded"
                      onChange={(e) =>
                        setSelectedReport(`teacher:${e.target.value}`)
                      }
                    >
                      <option value="">-- choose teacher --</option>
                      {technologies
                        .flatMap((t) =>
                          (t.teachers || []).map((tt) => ({
                            ...tt,
                            tech: t.id,
                          }))
                        )
                        .map((tt) => (
                          <option key={tt.id} value={tt.id}>
                            {tt.name} — {tt.id} ({tt.tech})
                          </option>
                        ))}
                    </select>
                    {selectedReport.startsWith("teacher:")
                      ? renderTeacherReport(selectedReport.split(":")[1])
                      : null}
                  </div>
                );

              if (selectedReport === "room")
                return (
                  <div>
                    <select
                      className="mb-2 p-2 border rounded"
                      onChange={(e) =>
                        setSelectedReport(`room:${e.target.value}`)
                      }
                    >
                      <option value="">-- choose room --</option>
                      {technologies
                        .flatMap((t) => Object.values(t.rooms).flat())
                        .map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                    </select>
                    {selectedReport.startsWith("room:")
                      ? renderRoomReport(selectedReport.split(":")[1])
                      : null}
                  </div>
                );

              if (selectedReport.startsWith("tech:"))
                return renderTechReport(selectedReport.split(":")[1]);
              if (selectedReport.startsWith("teacher:"))
                return renderTeacherReport(selectedReport.split(":")[1]);
              if (selectedReport.startsWith("room:"))
                return renderRoomReport(selectedReport.split(":")[1]);

              return null;
            })()}
          </div>
        </div>
      </section>

      <footer className="mt-6 text-sm text-gray-600">
        <div>
          Tips: Provide explicit room names by comma-separated list (e.g. CS-T1,
          CS-T2) to control exact room names and counts. After adding
          technologies and teachers click "Generate Routine". Use Print to print
          the visible report.
        </div>
      </footer>
    </div>
  );
}
