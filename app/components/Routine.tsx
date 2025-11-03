// "use client"
// import React, { useEffect, useState } from "react";

// // ClassRoutineApp — single-file React component designed for Next.js (App Router or pages)
// // - Tailwind-friendly markup (no Tailwind import required here)
// // - Simple greedy scheduler that respects:
// //    * technology (department) — each technology has many teachers
// //    * teachers have subject loads (hours per week) and preferred room type (lab/theory)
// //    * subjects declare whether they require lab or theory
// //    * limited labs and classrooms
// // - Produces reports: per-teacher routine, per-technology routine, per-lab routine, and master routine
// // - Print button uses window.print() to print currently selected report

// export default function ClassRoutineApp() {
//   // Config: days and periods per day
//   const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
//   const PERIODS_PER_DAY = 6; // 6 periods per day => 30 slots per week

//   // Sample data — replace with your real data or load from API/json
//   const sampleTechnologies = [
//     {
//       id: "cs",
//       name: "Computer Science",
//       rooms: { theory: ["CS-101", "CS-102"], lab: ["CS-Lab1"] },
//       subjects: [
//         { id: "cs101", title: "Programming I", hours: 4, type: "theory" },
//         { id: "cs102", title: "Physics for CS", hours: 2, type: "theory" },
//         { id: "csLab", title: "Prog Lab", hours: 4, type: "lab" },
//       ],
//       teachers: [
//         { id: "t1", name: "Alice", canDo: ["cs101", "csLab"], maxHours: 8 },
//         { id: "t2", name: "Bob", canDo: ["cs102"], maxHours: 4 },
//       ],
//     },
//     {
//       id: "ee",
//       name: "Electrical Eng",
//       rooms: { theory: ["EE-201"], lab: ["EE-Lab1", "EE-Lab2"] },
//       subjects: [
//         { id: "ee101", title: "Circuits", hours: 5, type: "theory" },
//         { id: "eeLab", title: "Circuits Lab", hours: 3, type: "lab" },
//       ],
//       teachers: [
//         { id: "t3", name: "Carla", canDo: ["ee101", "eeLab"], maxHours: 8 },
//       ],
//     },
//   ];

//   // State
//   const [data, setData] = useState(sampleTechnologies);
//   const [timetable, setTimetable] = useState(null); // master timetable structure
//   const [selectedReport, setSelectedReport] = useState("master");
//   const [generatedAt, setGeneratedAt] = useState(null);

//   // Utility: create empty weekly matrix for a room or teacher
//   const createEmptyMatrix = () => {
//     const slots = DAYS.length * PERIODS_PER_DAY;
//     return Array(slots).fill(null);
//   };

//   // Scheduler (naive greedy):
//   // - For each technology, for each subject, allocate subject.hours slots across the week's free slots
//   // - Prefer appropriate room type (lab/theory) and available teachers who can teach that subject and have remaining capacity
//   // - Fill slots in day-major order
//   const generateTimetable = () => {
//     // Master structures
//     const master = {
//       rooms: {}, // roomId -> slots
//       teachers: {}, // teacherId -> slots
//       techs: {}, // techId -> slots (for technology-level view)
//       slots: Array(DAYS.length * PERIODS_PER_DAY).fill(null), // global slot assignment (for master view)
//     };

//     // Initialize rooms and teachers with empty matrices
//     data.forEach((tech) => {
//       // tech-level
//       master.techs[tech.id] = createEmptyMatrix();

//       // rooms
//       Object.entries(tech.rooms).forEach(([kind, list]) => {
//         list.forEach((r) => (master.rooms[r] = createEmptyMatrix()));
//       });

//       // teachers
//       tech.teachers.forEach((t) => (master.teachers[t.id] = createEmptyMatrix()));
//     });

//     // Track remaining hours per subject and per teacher
//     const subjectQueue = [];
//     data.forEach((tech) => {
//       tech.subjects.forEach((sub) => {
//         subjectQueue.push({ techId: tech.id, subject: sub, remaining: sub.hours });
//       });
//     });

//     // Helper to find teacher for a subject in a technology
//     const findTeacherFor = (tech, subjectId) => {
//       const techObj = data.find((t) => t.id === tech);
//       if (!techObj) return null;
//       // find teacher who can do subject and still has capacity (based on maxHours minus assigned)
//       const candidates = techObj.teachers || [];
//       candidates.sort((a, b) => a.maxHours - b.maxHours); // prefer lower capacity first (simple heuristic)
//       for (const c of candidates) {
//         const assigned = master.teachers[c.id].filter(Boolean).length;
//         if (c.canDo.includes(subjectId) && assigned < c.maxHours) return c;
//       }
//       return null;
//     };

//     // Helper to find available room of type
//     const findAvailableRoom = (techId, kind, slotIndex) => {
//       const techObj = data.find((t) => t.id === techId);
//       if (!techObj) return null;
//       const rooms = techObj.rooms[kind] || [];
//       for (const r of rooms) {
//         if (!master.rooms[r][slotIndex]) return r;
//       }
//       return null;
//     };

//     // Iterate slots day-major
//     const totalSlots = DAYS.length * PERIODS_PER_DAY;
//     // We'll assign in rounds assigning one hour of a subject per pass to distribute evenly
//     let madeProgress = true;
//     while (madeProgress) {
//       madeProgress = false;
//       // Iterate subjects that still need hours
//       for (const item of subjectQueue) {
//         if (item.remaining <= 0) continue;
//         // find a slot to place one hour of this subject
//         // naive search: find first slot where tech and room and teacher free
//         for (let slot = 0; slot < totalSlots; slot++) {
//           if (master.slots[slot]) continue; // global slot occupied

//           const kind = item.subject.type === "lab" ? "lab" : "theory";
//           const room = findAvailableRoom(item.techId, kind, slot);
//           if (!room) continue; // no room free this slot

//           const teacher = findTeacherFor(item.techId, item.subject.id);
//           if (!teacher) continue; // no teacher available

//           // also ensure teacher free at slot
//           if (master.teachers[teacher.id][slot]) continue;

//           // assign
//           const entry = {
//             techId: item.techId,
//             subjectId: item.subject.id,
//             title: item.subject.title,
//             teacherId: teacher.id,
//             teacherName: teacher.name,
//             room,
//             kind,
//             day: Math.floor(slot / PERIODS_PER_DAY),
//             period: (slot % PERIODS_PER_DAY) + 1,
//             slot,
//           };

//           master.slots[slot] = entry;
//           master.rooms[room][slot] = entry;
//           master.teachers[teacher.id][slot] = entry;
//           master.techs[item.techId][slot] = entry;

//           item.remaining -= 1;
//           madeProgress = true;
//           break; // proceed to next subject
//         }
//       }
//     }

//     setTimetable(master);
//     setGeneratedAt(new Date().toISOString());
//   };

//   useEffect(() => {
//     // auto-generate when app loads
//     generateTimetable();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, []);

//   // Helpers to render matrix as table
//   const renderMatrixTable = (matrix, title) => {
//     return (
//       <div className="overflow-auto mt-4 border rounded p-2">
//         <h3 className="text-lg font-semibold mb-2">{title}</h3>
//         <table className="min-w-full table-auto border-collapse">
//           <thead>
//             <tr>
//               <th className="border px-2 py-1">Day/Period</th>
//               {Array.from({ length: PERIODS_PER_DAY }).map((_, p) => (
//                 <th key={p} className="border px-2 py-1">P{p + 1}</th>
//               ))}
//             </tr>
//           </thead>
//           <tbody>
//             {DAYS.map((d, di) => (
//               <tr key={d}>
//                 <td className="border px-2 py-1 font-medium">{d}</td>
//                 {Array.from({ length: PERIODS_PER_DAY }).map((_, pi) => {
//                   const slot = di * PERIODS_PER_DAY + pi;
//                   const cell = matrix ? matrix[slot] : null;
//                   return (
//                     <td key={pi} className="border px-2 py-1 align-top h-20">
//                       {cell ? (
//                         <div>
//                           <div className="font-semibold">{cell.title}</div>
//                           <div className="text-sm">{cell.teacherName} • {cell.room}</div>
//                         </div>
//                       ) : (
//                         <div className="text-sm text-gray-500">—</div>
//                       )}
//                     </td>
//                   );
//                 })}
//               </tr>
//             ))}
//           </tbody>
//         </table>
//       </div>
//     );
//   };

//   // Report renderers
//   const renderTeacherReport = (teacherId) => {
//     if (!timetable) return null;
//     const matrix = timetable.teachers[teacherId];
//     return renderMatrixTable(matrix, `Routine — Teacher: ${teacherId}`);
//   };

//   const renderTechReport = (techId) => {
//     if (!timetable) return null;
//     const matrix = timetable.techs[techId];
//     const tech = data.find((t) => t.id === techId);
//     return (
//       <div>
//         <h2 className="text-xl font-bold">{tech?.name} — Routine</h2>
//         {renderMatrixTable(matrix, `${tech?.name} Routine`)}
//       </div>
//     );
//   };

//   const renderLabReport = (roomId) => {
//     if (!timetable) return null;
//     const matrix = timetable.rooms[roomId];
//     return renderMatrixTable(matrix, `Room: ${roomId}`);
//   };

//   const renderMasterReport = () => {
//     if (!timetable) return null;
//     return (
//       <div>
//         <h2 className="text-2xl font-bold">Master Routine</h2>
//         <p className="text-sm text-gray-600">Generated at: {generatedAt}</p>
//         {renderMatrixTable(timetable.slotsToMatrix ? timetable.slotsToMatrix : timetable.slots, "Master View")}
//         {/* Master view mapping: we need to convert slots array to matrix-like mapping to reuse renderMatrixTable */}
//       </div>
//     );
//   };

//   // Because renderMatrixTable expects array[slot] mapping, ensure master.slots is compatible
//   const masterMatrix = timetable ? timetable.slots : null;

//   // Print handler: prints currently visible report (we'll wrap report in a printable div)
//   const handlePrint = () => {
//     window.print();
//   };

//   return (
//     <div className="p-6 max-w-7xl mx-auto">
//       <header className="flex items-center justify-between">
//         <h1 className="text-3xl font-bold">Class Routine Generator</h1>
//         <div className="space-x-2">
//           <button className="px-3 py-2 rounded bg-blue-600 text-white" onClick={generateTimetable}>
//             Regenerate
//           </button>
//           <button className="px-3 py-2 rounded bg-green-600 text-white" onClick={handlePrint}>
//             Print Report
//           </button>
//         </div>
//       </header>

//       <section className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
//         <div className="col-span-1">
//           <div className="bg-white p-4 rounded shadow">
//             <h2 className="font-semibold">Reports</h2>
//             <div className="mt-3 space-y-2">
//               <label className="flex items-center space-x-2">
//                 <input
//                   type="radio"
//                   name="report"
//                   checked={selectedReport === "master"}
//                   onChange={() => setSelectedReport("master")}
//                 />
//                 <span>Master Routine</span>
//               </label>

//               <label className="flex items-center space-x-2">
//                 <input
//                   type="radio"
//                   name="report"
//                   checked={selectedReport === "tech"}
//                   onChange={() => setSelectedReport("tech")}
//                 />
//                 <span>Technology Routine</span>
//               </label>

//               <label className="flex items-center space-x-2">
//                 <input
//                   type="radio"
//                   name="report"
//                   checked={selectedReport === "teacher"}
//                   onChange={() => setSelectedReport("teacher")}
//                 />
//                 <span>Teacher Routine</span>
//               </label>

//               <label className="flex items-center space-x-2">
//                 <input
//                   type="radio"
//                   name="report"
//                   checked={selectedReport === "room"}
//                   onChange={() => setSelectedReport("room")}
//                 />
//                 <span>Room / Lab Routine</span>
//               </label>
//             </div>

//             <div className="mt-4">
//               <h3 className="font-medium">Select target</h3>
//               {selectedReport === "tech" && (
//                 <select className="mt-2 w-full border p-2 rounded" onChange={(e) => setSelectedReport(`tech:${e.target.value}`)}>
//                   <option value="">-- choose technology --</option>
//                   {data.map((t) => (
//                     <option key={t.id} value={t.id}>{t.name}</option>
//                   ))}
//                 </select>
//               )}

//               {selectedReport === "teacher" && (
//                 <select className="mt-2 w-full border p-2 rounded" onChange={(e) => setSelectedReport(`teacher:${e.target.value}`)}>
//                   <option value="">-- choose teacher --</option>
//                   {data.flatMap((t) => t.teachers).map((tt) => (
//                     <option key={tt.id} value={tt.id}>{tt.name} — {tt.id}</option>
//                   ))}
//                 </select>
//               )}

//               {selectedReport === "room" && (
//                 <select className="mt-2 w-full border p-2 rounded" onChange={(e) => setSelectedReport(`room:${e.target.value}`)}>
//                   <option value="">-- choose room --</option>
//                   {data.flatMap((t) => Object.values(t.rooms).flat()).map((r) => (
//                     <option key={r} value={r}>{r}</option>
//                   ))}
//                 </select>
//               )}
//             </div>
//           </div>
//         </div>

//         <div className="col-span-2">
//           <div className="bg-white p-4 rounded shadow" id="printable-report">
//             {/* Render selected report */}
//             {(() => {
//               if (!timetable) return <div>Generating...</div>;

//               if (selectedReport === "master") {
//                 return renderMatrixTable(masterMatrix, "Master Routine");
//               }

//               if (selectedReport.startsWith("tech:")) {
//                 const techId = selectedReport.split(":")[1];
//                 return renderTechReport(techId);
//               }

//               if (selectedReport.startsWith("teacher:")) {
//                 const teacherId = selectedReport.split(":")[1];
//                 return renderTeacherReport(teacherId);
//               }

//               if (selectedReport.startsWith("room:")) {
//                 const roomId = selectedReport.split(":")[1];
//                 return renderLabReport(roomId);
//               }

//               // if user chose 'tech' but not selected specific -> prompt
//               if (selectedReport === "tech") return <div>Select a technology to view its routine.</div>;
//               if (selectedReport === "teacher") return <div>Select a teacher to view routine.</div>;
//               if (selectedReport === "room") return <div>Select a room to view routine.</div>;

//               return null;
//             })()}
//           </div>
//         </div>
//       </section>

//       <footer className="mt-6 text-sm text-gray-600">
//         <div>Notes:</div>
//         <ul className="list-disc ml-6">
//           <li>This is a starter implementation. The scheduler is a simple greedy allocator — for production, replace with constraint solver (ILP / SAT / genetic).</li>
//           <li>You can replace <code>sampleTechnologies</code> with a REST API or a JSON file and call <code>generateTimetable()</code> again.</li>
//           <li>Use browser print to print the displayed report (Print button provided).</li>
//         </ul>
//       </footer>
//     </div>
//   );
// }
