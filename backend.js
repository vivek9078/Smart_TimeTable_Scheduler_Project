// backend.js — FRONTEND (FULL BACKEND MODE)
// Replace LOCAL_STORAGE usage with real API calls to your Node backend.
// KEEP UI/HTML/CSS exactly the same.

const BASE_URL = "https://smart-tt-backend.onrender.com"; // <<--- REPLACE with your Render URL

// In-memory UI state
let subjects = [];
let teachers = [];
let allCoursesData = []; // cached list of courses (id, courseBranch, semester)
let generatedTimetables = null; // last generated timetable result
let lastSavedCourseId = null; // id returned by /api/courses after saving

/* -----------------------
   Utilities / UI helpers
   ----------------------- */
function validateInput(elementId) {
  const input = document.getElementById(elementId);
  if (!input || input.value.trim() === "") {
    input.classList.add("is-invalid");
    return false;
  }
  input.classList.remove("is-invalid");
  return true;
}
function setStepIndicator(currentStep) {
  document.querySelectorAll(".border-bottom").forEach((indicator) => {
    indicator.classList.remove("border-light", "opacity-100");
    indicator.classList.add("border-secondary", "opacity-50");
  });
  const indicator = document.getElementById(`step-${currentStep}-indicator`);
  if (indicator) {
    indicator.classList.remove("border-secondary", "opacity-50");
    indicator.classList.add("border-light", "opacity-100");
  }
}
function sanitizeCourseId(course, branch, semester) {
  if (!course || !branch || !semester) return null;
  return `${course.trim()}_${branch.trim()}_${semester.trim()}`
    .replace(/\s&\s/g, "-")
    .replace(/\s/g, "-")
    .toLowerCase();
}
function resetHODData() {
  subjects = [];
  teachers = [];
  generatedTimetables = null;
  lastSavedCourseId = null;
  ['courseName','branchName','semester','sectionNames','subjectName','subjectCode','teacherName'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const sp = document.getElementById('subjectPriority'); if (sp) sp.selectedIndex = 0;
  const st = document.getElementById('subjectType'); if (st) st.selectedIndex = 0;
  const subjList = document.getElementById('subjectList'); if (subjList) subjList.innerHTML = "";
  const teachList = document.getElementById('teacherList'); if (teachList) teachList.innerHTML = "";
  const subjectCheckboxes = document.getElementById('subjectCheckboxes'); if (subjectCheckboxes) subjectCheckboxes.innerHTML = "";
  document.querySelectorAll('.form-control, .form-select').forEach(el => el.classList.remove('is-invalid'));
  const adminCourseInput = document.getElementById("adminCourseInput"); if (adminCourseInput) adminCourseInput.value = "";
  const adminSemesterInput = document.getElementById("adminSemesterInput"); if (adminSemesterInput) adminSemesterInput.value = "";
  const ts = document.getElementById('timetableStatus'); if (ts) ts.textContent = "(Enter Course and Semester above and click Generate)";
}

/* -----------------------
   Navigation (same as HTML)
   ----------------------- */
window.showPanel = async function(panelId, reset=false) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById(panelId).classList.add('active');

  if (panelId === 'hodPanel') {
    if (reset) resetHODData();
    document.getElementById('courseSection').classList.add('active-section');
    document.getElementById('subjectSection').classList.remove('active-section');
    document.getElementById('teacherSection').classList.remove('active-section');
    setStepIndicator(1);
  } else if (panelId === 'adminPanel') {
    await loadAdminOptions();
  } else if (panelId === 'loginPanel' && reset) {
    resetHODData();
  }
};

window.nextStep = function(step) {
  if (step === 1) {
    let ok = validateInput('courseName') & validateInput('branchName') & validateInput('semester') & validateInput('sectionNames');
    if (!ok) return;
    document.getElementById('courseSection').classList.remove('active-section');
    document.getElementById('subjectSection').classList.add('active-section');
    setStepIndicator(2);
  } else if (step === 2) {
    if (subjects.length === 0) {
      alert("Error: Add at least one subject.");
      return;
    }
    document.getElementById('subjectSection').classList.remove('active-section');
    document.getElementById('teacherSection').classList.add('active-section');
    setStepIndicator(3);
    refreshSubjectCheckboxes();
  }
};

/* -----------------------
   HOD: Subjects & Teachers (UI handlers)
   ----------------------- */
window.addSubject = function() {
  const nameInput = document.getElementById('subjectName');
  const codeInput = document.getElementById('subjectCode');
  const prioritySelect = document.getElementById('subjectPriority');
  const typeSelect = document.getElementById('subjectType');

  let isValid = validateInput('subjectName') & validateInput('subjectCode') & validateInput('subjectPriority') & validateInput('subjectType');
  if (!isValid) return;

  const codeUpper = codeInput.value.trim().toUpperCase();
  if (subjects.some(s => s.code.toUpperCase() === codeUpper)) {
    alert(`🚫 Error: Subject code "${codeUpper}" already exists! Please use a unique code.`);
    return;
  }

  const sub = { name: nameInput.value.trim(), code: codeInput.value.trim(), priority: prioritySelect.value, type: typeSelect.value };
  subjects.push(sub);

  const li = document.createElement('li');
  li.textContent = `${sub.name} (${sub.code}) - P${sub.priority} - Type: ${sub.type}`;
  document.getElementById('subjectList').appendChild(li);

  nameInput.value = ""; codeInput.value = ""; prioritySelect.selectedIndex = 0; typeSelect.selectedIndex = 0;
};

function refreshSubjectCheckboxes() {
  const container = document.getElementById('subjectCheckboxes');
  container.innerHTML = "";
  subjects.forEach((sub, idx) => {
    const wrapper = document.createElement('div');
    wrapper.className = "form-check form-check-inline";
    wrapper.innerHTML = `
      <input type="checkbox" class="form-check-input subject-checkbox" id="sub_${idx}" value="${escapeHtml(sub.name)}">
      <label class="form-check-label" for="sub_${idx}">${escapeHtml(sub.name)} (${escapeHtml(sub.code)})</label>
    `;
    container.appendChild(wrapper);
  });
}

window.addTeacher = function() {
  const nameInput = document.getElementById('teacherName');
  const selectedSubjects = Array.from(document.querySelectorAll('#subjectCheckboxes input:checked')).map(cb => cb.value);

  const nameValid = validateInput('teacherName');
  const subjectsValid = selectedSubjects.length > 0;
  const feedbackDiv = document.getElementById('subjectCheckboxesFeedback');
  if (!subjectsValid) feedbackDiv.style.display = 'block'; else feedbackDiv.style.display = 'none';
  if (!nameValid || !subjectsValid) return;

  const teacherObj = { name: nameInput.value.trim(), email: "", subjects: selectedSubjects };
  teachers.push(teacherObj);

  const li = document.createElement('li');
  li.textContent = `${teacherObj.name} → ${teacherObj.subjects.join(', ')}`;
  document.getElementById('teacherList').appendChild(li);

  nameInput.value = "";
  document.querySelectorAll('#subjectCheckboxes input').forEach(cb => cb.checked = false);
  feedbackDiv.style.display = 'none';
};

/* -----------------------
   HOD: Save to backend
   ----------------------- */
window.finishHOD = async function() {
  if (teachers.length === 0) {
    alert("Warning: You have no teachers added. Please add teachers or the timetable generation will fail.");
    return;
  }

  const courseName = document.getElementById('courseName').value.trim();
  const branchName = document.getElementById('branchName').value.trim();
  const semester = document.getElementById('semester').value.trim();
  const sectionNamesRaw = document.getElementById('sectionNames').value;
  const sectionNames = sectionNamesRaw.split(',').map(s => s.trim().toUpperCase()).filter(s => s);

  if (!validateInput('courseName') || !validateInput('branchName') || !validateInput('semester') || sectionNames.length === 0) {
    alert("Please complete all course fields.");
    return;
  }

  const payload = {
    course: courseName,
    branch: branchName,
    semester: semester,
    sectionNames: sectionNames,
    subjects: subjects.map(s => ({ name: s.name, code: s.code, priority: s.priority, type: s.type })),
    teachers: teachers.map(t => ({ name: t.name, email: t.email || "", subjects: t.subjects }))
  };

  try {
    const res = await fetch(`${BASE_URL}/api/courses`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data && data.ok) {
      lastSavedCourseId = data.courseId;
      alert("✅ All HOD data saved successfully to database!");
      resetHODData();
      await loadAdminOptions(); // refresh admin list immediately
      showPanel('loginPanel', true);
    } else {
      console.error("Save failed:", data);
      alert("Error saving to server: " + (data.error || "unknown"));
    }
  } catch (err) {
    console.error("Network error saving course:", err);
    alert("Network error saving to backend. Make sure server is running and BASE_URL is correct.");
  }
};

/* -----------------------
   ADMIN: load courses list from backend
   ----------------------- */
async function fetchCoursesFromServer() {
  try {
    const res = await fetch(`${BASE_URL}/api/courses`);
    if (!res.ok) throw new Error("Failed to fetch courses");
    return await res.json();
  } catch (err) {
    console.error("Error fetching courses:", err);
    return [];
  }
}

async function loadAdminOptions() {
  const courseList = document.getElementById('adminCourseList');
  courseList.innerHTML = '';
  allCoursesData = [];

  const rows = await fetchCoursesFromServer();
  rows.forEach(r => {
    const courseBranch = `${r.course_name} - ${r.branch_name}`;
    const option = document.createElement('option');
    option.value = courseBranch;
    courseList.appendChild(option);
    allCoursesData.push({
      id: r.id,
      courseBranch: courseBranch,
      semester: r.semester
    });
  });
}

/* -----------------------
   GENERATE: call backend to generate timetable
   ----------------------- */
window.handleGenerateTimetable = async function () {
  const courseBranchInput = document.getElementById('adminCourseInput');
  const semesterInput = document.getElementById('adminSemesterInput');
  const loadingIndicator = document.getElementById('loadingIndicator');
  const timetableStatus = document.getElementById('timetableStatus');

  const courseBranch = courseBranchInput.value.trim();
  const semester = semesterInput.value.trim();

  // Clear previous UI
  document.getElementById("sectionTabs").innerHTML = "";
  document.getElementById("sectionTabContent").innerHTML = "";
  document.getElementById("downloadButtonsContainer").innerHTML = `
    <button class="btn-custom w-100 mt-3" onclick="downloadTimetable()">⬇ Download Timetable (All Sections)</button>
    <button class="btn-custom w-100 mt-2" onclick="downloadTeacherTimetable()">⬇ Download Timetable (All Teachers)</button>
  `;

  if (!courseBranch || !semester) {
    loadingIndicator.style.display = "none";
    timetableStatus.textContent = "Please enter the Course/Branch and Semester.";
    return;
  }

  // find matching course object (we fetched courseBranch list earlier)
  await loadAdminOptions(); // refresh cache for safety
  const matched = allCoursesData.find(
    c => c.courseBranch === courseBranch && String(c.semester) === String(semester)
  );
  if (!matched) {
    loadingIndicator.style.display = "none";
    timetableStatus.textContent = `Error: No course data found for ${courseBranch}, Semester ${semester}. Make sure HOD saved the course first.`;
    return;
  }

  loadingIndicator.style.display = "block";
  timetableStatus.textContent = `Generating Timetables...`;

  try {
    const res = await fetch(`${BASE_URL}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courseId: matched.id })
    });
    const data = await res.json();
    loadingIndicator.style.display = "none";
    if (data && data.ok && data.timetable) {
      generatedTimetables = normalizeServerTimetable(data.timetable);
      renderTimetablesFromServer(generatedTimetables, courseBranch, semester);
      timetableStatus.textContent = `✅ Timetables generated for ${generatedTimetables.sections.length} sections.`;
    } else {
      console.error("Generate failed:", data);
      timetableStatus.textContent = `Error generating timetable: ${data && data.error ? data.error : "unknown"}`;
    }
  } catch (err) {
    loadingIndicator.style.display = "none";
    console.error("Network error generating timetable:", err);
    timetableStatus.textContent = "Network error generating timetable. Make sure backend is running.";
  }
};

/* -----------------------
   Helpers to normalize server timetable format to what UI expects
   ----------------------- */
function normalizeServerTimetable(serverTimetable) {
  const out = { sections: [], teacherSchedules: {} };
  if (!serverTimetable) return out;

  if (Array.isArray(serverTimetable.sections) && serverTimetable.sections.length > 0 && serverTimetable.sections[0].sectionName !== undefined) {
    serverTimetable.sections.forEach(secObj => {
      const name = secObj.sectionName || secObj.section;
      out.sections.push(name);
      out[name] = secObj.timetable || {};
    });
    out.teacherSchedules = serverTimetable.teacherSchedules || {};
    return out;
  }

  if (Array.isArray(serverTimetable.sections)) {
    out.sections = serverTimetable.sections.slice();
    out.sections.forEach(sec => out[sec] = serverTimetable[sec] || {});
    out.teacherSchedules = serverTimetable.teacherSchedules || {};
    return out;
  }

  Object.keys(serverTimetable).forEach(k => {
    if (k === 'teacherSchedules') out.teacherSchedules = serverTimetable[k];
    else if (typeof serverTimetable[k] === 'object') {
      out.sections.push(k);
      out[k] = serverTimetable[k];
    }
  });

  return out;
}

/* -----------------------
   Rendering timetables (UI)
   ----------------------- */
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SLOTS = ["8:00-8:55", "8:55-9:50", "10:10-11:05", "11:05-12:00", "12:00-12:55", "12:55-1:50", "2:10-3:05", "3:05-4:00", "4:00-4:55", "4:55-5:50"];

function formatCellForDisplay(c) {
  if (!c || c === 'Free') return 'Free';
  if (typeof c === 'string') return c;
  // c is object { subject, teacher, code, type } or {section, ...} for teacher
  const code = c.code || '';
  const subj = c.subject || '';
  const t = c.teacher || '';
  const teacherInitial = t ? `(${t.charAt(0).toLowerCase()})` : '';
  const typeShort = (c.type && c.type.toLowerCase().includes('lab')) ? '(l)' : (c.type && c.type.toLowerCase().includes('theory')) ? '(t)' : '';
  // For section entries, if object contains 'section' we might display section differently for teacher view; here use subject+initial
  return `[${code}] ${subj} ${teacherInitial} ${typeShort}`.trim();
}

function generateTableHTML(timetable) {
  const headerRow = `<tr><th>Day/Time</th>${SLOTS.map(s => `<th>${s}</th>`).join('')}</tr>`;
  const bodyRows = DAYS.map(day => {
    const rowCells = (timetable[day] || []).map((c, i) => {
      let display = '';
      if (c && typeof c === 'object') display = formatCellForDisplay(c);
      else display = (c === undefined || c === null) ? '' : c;
      const style = display === 'Free' ? 'opacity:0.6;font-style:italic;' : '';
      return `<td style="${style}">${escapeHtml(display)}</td>`;
    }).join('');
    return `<tr><td>${day}</td>${rowCells}</tr>`;
  }).join('');
  return `
    <div class="table-responsive mt-3">
      <table class="table table-bordered text-white">
        <thead>${headerRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
}

function renderTimetablesFromServer(allTimetables, courseBranch, semester) {
  const sections = allTimetables.sections || [];
  const tabsContainer = document.getElementById('sectionTabs');
  const contentContainer = document.getElementById('sectionTabContent');
  tabsContainer.innerHTML = '';
  contentContainer.innerHTML = '';

  sections.forEach((section, idx) => {
    const isActive = idx === 0;
    const tabId = `tab-${section}`;
    const paneId = `pane-${section}`;
    tabsContainer.innerHTML += `
      <li class="nav-item" role="presentation">
        <button class="nav-link ${isActive ? 'active' : ''} text-white" id="${tabId}" data-bs-toggle="tab" data-bs-target="#${paneId}" type="button" role="tab" aria-controls="${paneId}" aria-selected="${isActive}">
          Section ${section}
        </button>
      </li>
    `;
    const pane = document.createElement('div');
    pane.className = 'tab-pane fade bg-dark p-3';
    if (isActive) pane.classList.add('show','active');
    pane.id = paneId;
    pane.setAttribute('role','tabpanel');
    pane.setAttribute('aria-labelledby', tabId);
    pane.innerHTML = generateTableHTML(allTimetables[section] || {});
    contentContainer.appendChild(pane);
  });

  generatedTimetables = allTimetables;
}

/* -----------------------
   CSV formatting helpers
   ----------------------- */
function formatCellForCSV(c) {
  if (!c || c === 'Free') return 'Free';
  if (typeof c === 'string') return c.trim();
  // object with section/code/subject/type
  if (c.section) {
    // teacher schedule object: { section, code, subject, type }
    return `[${c.code}] ${c.subject} (${c.section})`;
  }
  const teacherInitial = c.teacher ? `(${c.teacher.charAt(0).toLowerCase()})` : '';
  const typeShort = (c.type && c.type.toLowerCase().includes('lab')) ? '(l)' : (c.type && c.type.toLowerCase().includes('theory')) ? '(t)' : '';
  return `[${c.code}] ${c.subject} ${teacherInitial} ${typeShort}`.trim();
}

/* -----------------------
   Download CSV functions
   ----------------------- */
window.downloadTimetable = function () {
  const course = document.getElementById('adminCourseInput').value || 'Course';
  const semester = document.getElementById('adminSemesterInput').value || 'Sem';
  if (!generatedTimetables || !generatedTimetables.sections) {
    alert("Please generate the timetable first.");
    return;
  }
  let csvParts = [];
  generatedTimetables.sections.forEach(section => {
    const tt = generatedTimetables[section];
    csvParts.push(`=== Section ${section} ===`);
    csvParts.push(`Day/Time,${SLOTS.join(',')}`);
    DAYS.forEach(d => {
      const row = [d].concat((tt[d] || []).map(cell => `"${formatCellForCSV(cell).replace(/"/g,'""')}"`));
      csvParts.push(row.join(','));
    });
    csvParts.push('');
  });
  const content = csvParts.join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `Sections_${course.replace(/\s/g,'-')}_Sem${semester}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

window.downloadTeacherTimetable = function () {
  if (!generatedTimetables || !generatedTimetables.teacherSchedules) {
    alert("Please generate the timetable first.");
    return;
  }
  const course = document.getElementById('adminCourseInput').value || 'Course';
  const semester = document.getElementById('adminSemesterInput').value || 'Sem';
  const ts = generatedTimetables.teacherSchedules || {};
  let csvParts = [];
  Object.keys(ts).forEach(teacher => {
    csvParts.push(`=== Teacher: ${teacher} ===`);
    csvParts.push(`Day/Time,${SLOTS.join(',')}`);
    DAYS.forEach(d => {
      const row = [d].concat((ts[teacher][d] || []).map(cell => `"${formatCellForCSV(cell).replace(/"/g,'""')}"`));
      csvParts.push(row.join(','));
    });
    csvParts.push('');
  });
  const content = csvParts.join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = `Teachers_${course.replace(/\s/g,'-')}_Sem${semester}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/* -----------------------
   Small utilities
   ----------------------- */
function escapeHtml(str) {
  if (str === undefined || str === null) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* -----------------------
   Init
   ----------------------- */
document.addEventListener('DOMContentLoaded', () => {
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) loadingIndicator.style.display = 'none';
});
