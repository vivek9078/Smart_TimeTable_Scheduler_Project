// --- backend.js (FULL FIXED CODE) ---

// --- LOCAL STORAGE SETUP ---
const LOCAL_STORAGE_DATA_KEY = 'SmartSchedulerData';
const LAST_EDITED_COURSE_KEY = 'lastEditedCourseId';

let subjects = [];
let teachers = [];
let allCoursesData = [];
let generatedTimetables = {}; // filled after generation

// Helper: localStorage
function getAllLocalData() {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_DATA_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Error retrieving data from localStorage:", e);
        return {};
    }
}
function saveAllLocalData(data) {
    try {
        localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error("Error saving data to localStorage:", e);
        return false;
    }
}

// --- HOD UI / Helpers (unchanged behaviour) ---
async function loadHODData(courseId) {
    if (!courseId) return false;
    const allData = getAllLocalData();
    const data = allData[courseId];
    if (data) {
        document.getElementById('courseName').value = data.course || '';
        document.getElementById('branchName').value = data.branch || '';
        document.getElementById('semester').value = data.semester || '';
        document.getElementById('sectionNames').value = (data.sectionNames && data.sectionNames.join(', ')) || '';
        subjects = data.subjects || [];
        document.getElementById('subjectList').innerHTML = '';
        subjects.forEach(sub => {
            let li = document.createElement('li');
            li.textContent = `${sub.name} (${sub.code}) - P${sub.priority} - Type: ${sub.type}`;
            document.getElementById('subjectList').appendChild(li);
        });
        teachers = data.teachers || [];
        document.getElementById('teacherList').innerHTML = '';
        teachers.forEach(t => {
            let li = document.createElement('li');
            li.textContent = `${t.name} → ${t.subjects.join(', ')}`;
            document.getElementById('teacherList').appendChild(li);
        });
        return true;
    }
    return false;
}

function sanitizeCourseId(course, branch, semester) {
    if (!course || !branch || !semester) return null;
    return `${course.trim()}_${branch.trim()}_${semester.trim()}`
        .replace(/\s&\s/g, '-')
        .replace(/\s/g, '-')
        .toLowerCase();
}
function validateInput(elementId) {
    const input = document.getElementById(elementId);
    if (!input || input.value.trim() === '') {
        input.classList.add('is-invalid');
        return false;
    }
    input.classList.remove('is-invalid');
    return true;
}
function setStepIndicator(currentStep) {
    document.querySelectorAll('.border-bottom').forEach(indicator => {
        indicator.classList.remove('border-light', 'opacity-100');
        indicator.classList.add('border-secondary', 'opacity-50');
    });
    const indicator = document.getElementById(`step-${currentStep}-indicator`);
    if (indicator) {
        indicator.classList.remove('border-secondary', 'opacity-50');
        indicator.classList.add('border-light', 'opacity-100');
    }
}
function resetHODData() {
    subjects = [];
    teachers = [];
    generatedTimetables = {};
    ['courseName', 'branchName', 'semester', 'sectionNames', 'subjectName', 'subjectCode', 'teacherName'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('subjectPriority').selectedIndex = 0;
    document.getElementById('subjectType').selectedIndex = 0;
    document.getElementById('subjectList').innerHTML = '';
    document.getElementById('teacherList').innerHTML = '';
    document.getElementById('subjectCheckboxes').innerHTML = '';
    document.querySelectorAll('.form-control, .form-select').forEach(el => {
        el.classList.remove('is-invalid');
        el.style.backgroundColor = '';
        el.style.color = 'white';
    });
    const adminCourseInput = document.getElementById('adminCourseInput');
    if (adminCourseInput) adminCourseInput.value = '';
    const adminSemesterInput = document.getElementById('adminSemesterInput');
    if (adminSemesterInput) adminSemesterInput.value = '';
    const ts = document.getElementById('timetableStatus');
    if (ts) ts.textContent = "(Enter Course and Semester above and click Generate)";
    localStorage.removeItem(LAST_EDITED_COURSE_KEY);
}

window.showPanel = async function (panelId, reset = false) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
    if (panelId === 'hodPanel') {
        const lastCourseId = localStorage.getItem(LAST_EDITED_COURSE_KEY);
        if (reset || !lastCourseId) resetHODData();
        else {
            const loaded = await loadHODData(lastCourseId);
            if (!loaded) resetHODData();
        }
        document.getElementById('courseSection').classList.add('active-section');
        document.getElementById('subjectSection').classList.remove('active-section');
        document.getElementById('teacherSection').classList.remove('active-section');
        setStepIndicator(1);
    } else if (panelId === 'adminPanel') {
        loadAdminOptions();
    } else if (panelId === 'loginPanel' && reset) {
        resetHODData();
    }
}

window.nextStep = function (step) {
    if (step === 1) {
        let isValid = validateInput('courseName');
        isValid &= validateInput('branchName');
        isValid &= validateInput('semester');
        isValid &= validateInput('sectionNames');
        if (!isValid) return;
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
        let subjectContainer = document.getElementById('subjectCheckboxes');
        subjectContainer.innerHTML = '';
        subjects.forEach((sub, index) => {
            let div = document.createElement('div');
            div.innerHTML = `
                <div class="form-check form-check-inline">
                    <input type="checkbox" class="form-check-input subject-checkbox" id="sub_${index}" value="${sub.name}">
                    <label class="form-check-label" for="sub_${index}">${sub.name} (${sub.code})</label>
                </div>`;
            subjectContainer.appendChild(div.querySelector('.form-check-inline'));
        });
    }
}

window.addSubject = function () {
    let nameInput = document.getElementById('subjectName');
    let codeInput = document.getElementById('subjectCode');
    let prioritySelect = document.getElementById('subjectPriority');
    let typeSelect = document.getElementById('subjectType');
    let isValid = validateInput('subjectName');
    isValid &= validateInput('subjectCode');
    isValid &= validateInput('subjectPriority');
    isValid &= validateInput('subjectType');
    if (!isValid) return;
    if (subjects.some(sub => sub.code.toUpperCase() === codeInput.value.toUpperCase())) {
        alert(`🚫 Error: Subject code "${codeInput.value.toUpperCase()}" already exists! Please use a unique code.`);
        return;
    }
    subjects.push({
        name: nameInput.value,
        code: codeInput.value,
        priority: prioritySelect.value,
        type: typeSelect.value
    });
    let li = document.createElement('li');
    li.textContent = `${nameInput.value} (${codeInput.value}) - P${prioritySelect.value} - Type: ${typeSelect.value}`;
    document.getElementById('subjectList').appendChild(li);
    nameInput.value = '';
    codeInput.value = '';
    prioritySelect.selectedIndex = 0;
    typeSelect.selectedIndex = 0;
}

window.addTeacher = function () {
    let nameInput = document.getElementById('teacherName');
    let selectedSubjects = Array.from(document.querySelectorAll('#subjectCheckboxes input:checked')).map(cb => cb.value);
    let nameValid = validateInput('teacherName');
    let subjectsValid = selectedSubjects.length > 0;
    const feedbackDiv = document.getElementById('subjectCheckboxesFeedback');
    if (!subjectsValid) feedbackDiv.style.display = 'block';
    else feedbackDiv.style.display = 'none';
    if (!nameValid || !subjectsValid) return;
    teachers.push({ name: nameInput.value, subjects: selectedSubjects });
    let li = document.createElement('li');
    li.textContent = `${nameInput.value} → ${selectedSubjects.join(', ')}`;
    document.getElementById('teacherList').appendChild(li);
    nameInput.value = '';
    document.querySelectorAll('#subjectCheckboxes input').forEach(cb => cb.checked = false);
    feedbackDiv.style.display = 'none';
}

window.finishHOD = async function () {
    if (teachers.length === 0) {
        alert("Warning: You have no teachers added. Please add teachers or the timetable generation will fail.");
        return;
    }
    const courseName = document.getElementById('courseName').value;
    const branchName = document.getElementById('branchName').value;
    const semester = document.getElementById('semester').value;
    const sectionNames = document.getElementById('sectionNames').value.split(',').map(s => s.trim().toUpperCase()).filter(s => s);
    if (!validateInput('courseName') || !validateInput('branchName') || !validateInput('semester') || !validateInput('sectionNames')) {
        alert("Please complete all course fields.");
        return;
    }
    const docId = sanitizeCourseId(courseName, branchName, semester);
    const dataToSave = {
        course: courseName,
        branch: branchName,
        semester: semester,
        sectionNames: sectionNames,
        subjects: subjects,
        teachers: teachers,
        updatedAt: new Date().toISOString()
    };
    const allData = getAllLocalData();
    allData[docId] = dataToSave;
    if (saveAllLocalData(allData)) {
        console.log("HOD Data saved successfully to localStorage with ID:", docId);
        alert("✅ All HOD data saved successfully!");
        localStorage.setItem(LAST_EDITED_COURSE_KEY, docId);
        resetHODData();
        showPanel('loginPanel');
    } else {
        alert("Error: Failed to save data to local storage. Your browser may be full or blocking storage.");
    }
}

// --- ADMIN PANEL ---
async function loadAdminOptions() {
    const courseList = document.getElementById('adminCourseList');
    courseList.innerHTML = '';
    allCoursesData = [];
    const allData = getAllLocalData();
    Object.keys(allData).forEach(id => {
        const data = allData[id];
        const courseBranch = `${data.course} - ${data.branch}`;
        const option = document.createElement('option');
        option.value = courseBranch;
        courseList.appendChild(option);
        allCoursesData.push({
            id: id,
            courseBranch: courseBranch,
            semester: data.semester,
            sectionNames: data.sectionNames,
            subjects: data.subjects,
            teachers: data.teachers
        });
    });
    console.log("Loaded courses for Admin panel from localStorage.");
}

// --- SCHEDULER CONFIG ---
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const SLOTS = ["08:00-08:55", "08:55-09:50", "10:10-11:05", "11:05-12:00", "12:00-12:55", "12:55-01:50", "02:10-03:05", "03:05-04:00", "04:00-04:55", "04:55-05:50"];
const MAX_CONSECUTIVE_CLASSES = 3;
const PERIOD_REQUIREMENTS = {
    '1': { Theory: 3, Lab: 2 },
    '2': { Theory: 2, Lab: 1 },
    '3': { Theory: 1, Lab: 1 }
};
const LAB_SLOT_SIZE = 2;

/**
 * generateTimetable:
 * - Returns an object:
 * { sections: [..], <sectionName>: { Mon: [...], ... }, teacherSchedules: { teacherName: { Mon: [...], ... } } }
 */
function generateTimetable(courseData) {
    const sectionLabels = courseData.sectionNames.slice();
    // Initialize structures
    const sectionTimetables = {}; // sectionTimetables[section][day] = array of slots
    const teacherSchedules = {};  // teacherSchedules[teacher][day] = array of slots
    const subjectTeachers = {};   // subjectTeachers[subjectName] = [teacherNames]
    const sectionTeacherMap = {}; // sectionTeacherMap[section][subject] = teacherName
    const counts = {};            // counts[subject][teacherName] for balanced distribution

    // Init section timetables & mapping
    sectionLabels.forEach(sec => {
        sectionTimetables[sec] = {};
        DAYS.forEach(d => sectionTimetables[sec][d] = Array(SLOTS.length).fill('Free'));
        sectionTeacherMap[sec] = {};
    });

    // Init teachers and subject->teacher map
    (courseData.teachers || []).forEach(t => {
        teacherSchedules[t.name] = {};
        DAYS.forEach(d => teacherSchedules[t.name][d] = Array(SLOTS.length).fill('Free'));
        (t.subjects || []).forEach(s => {
            if (!subjectTeachers[s]) subjectTeachers[s] = [];
            subjectTeachers[s].push(t.name);
        });
    });

    // initialize counts
    Object.keys(subjectTeachers).forEach(sub => {
        counts[sub] = {};
        subjectTeachers[sub].forEach(tn => counts[sub][tn] = 0);
    });

    // Assign a teacher for each (section, subject) — balanced distribution
    function assignTeacherToSectionForSubject(section, subject) {
        if (sectionTeacherMap[section][subject]) return sectionTeacherMap[section][subject];
        const candidates = subjectTeachers[subject] || [];
        if (candidates.length === 0) {
            sectionTeacherMap[section][subject] = 'Unassigned';
            return 'Unassigned';
        }
        // pick teacher with min assigned sections for this subject
        let selected = candidates[0];
        let minCount = counts[subject][selected];
        candidates.forEach(tn => {
            if (counts[subject][tn] < minCount) {
                selected = tn;
                minCount = counts[subject][tn];
            }
        });
        counts[subject][selected] += 1;
        sectionTeacherMap[section][subject] = selected;
        return selected;
    }

    // Build scheduling tasks: for each section, subject -> multiple slots
    const schedulingQueue = []; // each task: { section, subjectName, code, isLab, slotsRequired, teacher }
    (courseData.subjects || []).forEach(sub => {
        const req = PERIOD_REQUIREMENTS[sub.priority];
        const isLab = (sub.type === 'Lab');
        const periods = isLab ? req.Lab : req.Theory;
        sectionLabels.forEach(sec => {
            const assignedTeacher = assignTeacherToSectionForSubject(sec, sub.name);
            for (let k = 0; k < periods; k++) {
                schedulingQueue.push({
                    section: sec,
                    subjectName: sub.name,
                    code: sub.code,
                    isLab: isLab,
                    slotsRequired: isLab ? LAB_SLOT_SIZE : 1,
                    teacher: assignedTeacher
                });
            }
        });
    });

    // Shuffle helper
    function shuffleArray(arr) {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
    }

    // Helpers to check availability and consecutive constraints
    function teacherIsFree(teacherName, day, start, length) {
        if (!teacherSchedules[teacherName]) return false;
        for (let i = 0; i < length; i++) {
            if (teacherSchedules[teacherName][day][start + i] !== 'Free') return false;
        }
        // check consecutive constraint if placed
        let before = 0;
        for (let p = start - 1; p >= 0; p--) {
            if (teacherSchedules[teacherName][day][p] !== 'Free') before++; else break;
        }
        let after = 0;
        const end = start + length - 1;
        for (let p = end + 1; p < SLOTS.length; p++) {
            if (teacherSchedules[teacherName][day][p] !== 'Free') after++; else break;
        }
        const total = before + length + after;
        return total <= MAX_CONSECUTIVE_CLASSES;
    }
    function sectionIsFree(section, day, start, length) {
        for (let i = 0; i < length; i++) {
            if (sectionTimetables[section][day][start + i] !== 'Free') return false;
        }
        // check student consecutive constraint
        let before = 0;
        for (let p = start - 1; p >= 0; p--) {
            if (sectionTimetables[section][day][p] !== 'Free') before++; else break;
        }
        let after = 0;
        const end = start + length - 1;
        for (let p = end + 1; p < SLOTS.length; p++) {
            if (sectionTimetables[section][day][p] !== 'Free') after++; else break;
        }
        const total = before + length + after;
        return total <= MAX_CONSECUTIVE_CLASSES;
    }

    // Main greedy scheduler loop with safeguards
    let attempts = 0;
    let maxAttempts = schedulingQueue.length * 500; // safety cap
    // We'll try to schedule tasks; if a task cannot be scheduled after exploring all slots/days it will be requeued.
    while (schedulingQueue.length > 0 && attempts < maxAttempts) {
        attempts++;
        const task = schedulingQueue.shift();

        // If no teacher exists -> skip (will be reported as unassigned)
        if (task.teacher === 'Unassigned') {
            console.warn(`No teacher for ${task.subjectName} (section ${task.section}). Skipping task.`);
            continue;
        }

        let placed = false;
        // try random order of days to distribute load
        const daysOrder = DAYS.slice();
        shuffleArray(daysOrder);
        for (const day of daysOrder) {
            for (let slotIndex = 0; slotIndex <= SLOTS.length - task.slotsRequired; slotIndex++) {
                // quick availability checks
                if (!teacherIsFree(task.teacher, day, slotIndex, task.slotsRequired)) continue;
                if (!sectionIsFree(task.section, day, slotIndex, task.slotsRequired)) continue;
                // All good: place it
                // For teacherSchedules we put "Section [Code]" in teacher cell (as user requested)
                for (let j = 0; j < task.slotsRequired; j++) {
                    sectionTimetables[task.section][day][slotIndex + j] = `[${task.code}] ${task.subjectName} (${task.teacher.split(' ')[0][0] || task.teacher[0]})`;
                    teacherSchedules[task.teacher][day][slotIndex + j] = `${task.section} [${task.code}]`;
                }
                placed = true;
                break;
            }
            if (placed) break;
        }

        if (!placed) {
            // couldn't place now — push back to queue to try later
            schedulingQueue.push(task);
        }
    }

    // If schedulingQueue still has tasks after attempts, they couldn't be placed — log them
    if (schedulingQueue.length > 0) {
        console.warn("Some tasks could not be scheduled after multiple attempts:", schedulingQueue);
        // We leave those unplaced (they'll remain absent from timetable). Could surface to UI later.
    }

    // Build output object
    const output = { sections: sectionLabels };
    sectionLabels.forEach(sec => { output[sec] = sectionTimetables[sec]; });
    output.teacherSchedules = teacherSchedules;
    return output;
}

// --- RENDER / UI (sections) (unchanged) ---
function generateTableHTML(timetable) {
    const tableHTML = `
        <div class="table-responsive mt-3">
            <table class="table table-bordered text-white">
                <thead>
                    <tr><th>Day/Time</th>${SLOTS.map(slot => `<th>${slot}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${DAYS.map(day => {
        let row = `<tr><td>${day}</td>`;
        // find first/last scheduled for nicer Free/blank rendering
        let lastScheduledIndex = -1;
        for (let i = SLOTS.length - 1; i >= 0; i--) {
            if (timetable[day][i] !== 'Free') { lastScheduledIndex = i; break; }
        }
        let firstScheduledIndex = SLOTS.length;
        for (let i = 0; i < SLOTS.length; i++) {
            if (timetable[day][i] !== 'Free') { firstScheduledIndex = i; break; }
        }

        timetable[day].forEach((slotContent, i) => {
            let displayContent = slotContent;
            let cellStyle = '';
            if (slotContent === 'Free') {
                if (i > lastScheduledIndex || i < firstScheduledIndex) displayContent = '';
                else { displayContent = 'Free'; cellStyle = 'opacity:0.5;font-style:italic;'; }
            }
            row += `<td style="${cellStyle}">${displayContent}</td>`;
        });
        return row + `</tr>`;
    }).join('')}
                </tbody>
            </table>
        </div>
    `;
    return tableHTML;
}

function renderMultiTimetable(allTimetables, courseBranch, semester) {
    const sections = allTimetables.sections || [];
    const tabsContainer = document.getElementById('sectionTabs');
    const contentContainer = document.getElementById('sectionTabContent');
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';
    sections.forEach((section, index) => {
        const isActive = index === 0;
        const tabId = `tab-${section}`;
        const paneId = `pane-${section}`;
        tabsContainer.innerHTML += `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${isActive ? 'active' : ''} text-white" id="${tabId}" data-bs-toggle="tab" data-bs-target="#${paneId}" type="button" role="tab" aria-controls="${paneId}" aria-selected="${isActive}">
                    Section ${section}
                </button>
            </li>`;
        const pane = document.createElement('div');
        pane.classList.add('tab-pane', 'fade', 'bg-dark', 'p-3');
        if (isActive) pane.classList.add('show', 'active');
        pane.id = paneId;
        pane.setAttribute('role', 'tabpanel');
        pane.setAttribute('aria-labelledby', tabId);
        pane.innerHTML = generateTableHTML(allTimetables[section]);
        contentContainer.appendChild(pane);
    });
}

// --- DOWNLOAD (sections) ---
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
            const row = [d].concat(tt[d].map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`));
            csvParts.push(row.join(','));
        });
        csvParts.push(''); // blank line between sections
    });
    const content = csvParts.join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `Sections_${course.replace(/\s/g, '-')}_Sem${semester}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// --- DOWNLOAD (teachers) ---
window.downloadTeacherTimetable = function () {
    if (!generatedTimetables || !generatedTimetables.teacherSchedules) {
        alert("Please generate the timetable first.");
        return;
    }
    const course = document.getElementById('adminCourseInput').value || 'Course';
    const semester = document.getElementById('adminSemesterInput').value || 'Sem';
    const ts = generatedTimetables.teacherSchedules;
    let csvParts = [];
    Object.keys(ts).forEach(teacher => {
        csvParts.push(`=== Teacher: ${teacher} ===`);
        csvParts.push(`Day/Time,${SLOTS.join(',')}`);
        DAYS.forEach(d => {
            const row = [d].concat(ts[teacher][d].map(cell => `"${(cell || '').toString().replace(/"/g, '""')}"`));
            csvParts.push(row.join(','));
        });
        csvParts.push('');
    });
    const content = csvParts.join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `Teachers_${course.replace(/\s/g, '-')}_Sem${semester}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

// --- GENERATE BUTTON HANDLER (ties everything together) ---
window.handleGenerateTimetable = async function () {
    const courseBranchInput = document.getElementById('adminCourseInput');
    const semesterInput = document.getElementById('adminSemesterInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const timetableStatus = document.getElementById('timetableStatus');

    const courseBranch = courseBranchInput.value;
    const semester = semesterInput.value;

    // 1. Clear previous timetable data regardless of input status
    document.getElementById("sectionTabs").innerHTML = "";
    document.getElementById("sectionTabContent").innerHTML = "";
    document.getElementById("downloadButtonsContainer").innerHTML = `
        <button class="btn-custom w-100 mt-3" onclick="downloadTimetable()">⬇ Download Timetable (All Sections)</button>
        <button class="btn-custom w-100 mt-2" onclick="downloadTeacherTimetable()">⬇ Download Timetable (All Teachers)</button>
    `;

    // 2. CHECK FOR MISSING INPUTS FIRST
    if (!courseBranch || !semester) {
        // Correctly show error status if required fields are empty
        loadingIndicator.style.display = 'none'; // Hide loading bar if visible
        timetableStatus.textContent = "Please enter the Course/Branch and Semester.";
        return; // Exit function early
    }

    // 3. SEARCH FOR DATA AND SET LOADING STATE
    const selectedCourseData = allCoursesData.find(c =>
        c.courseBranch === courseBranch &&
        c.semester.toString() === semester.toString()
    );

    if (!selectedCourseData) {
        // Show error status if data is not found
        loadingIndicator.style.display = 'none';
        timetableStatus.textContent = `Error: No course data found for ${courseBranch}, Semester ${semester}.`;
        return; // Exit function early
    }

    // If data is found, show loading state and proceed
    loadingIndicator.style.display = 'block';
    timetableStatus.textContent = `Generating Timetables...`;

    // small wait so UI updates
    await new Promise(r => setTimeout(r, 400));

    // 4. GENERATE AND RENDER
    generatedTimetables = generateTimetable(selectedCourseData);

    // Render
    if (generatedTimetables && generatedTimetables.sections && generatedTimetables.sections.length > 0) {
        renderMultiTimetable(generatedTimetables, courseBranch, semester);
        loadingIndicator.style.display = 'none';
        timetableStatus.textContent = `✅ Timetables generated for ${generatedTimetables.sections.length} sections.`;

    } else {
        loadingIndicator.style.display = 'none';
        timetableStatus.textContent = `Error: Could not generate a valid timetable. (Check HOD inputs: subjects/teachers).`;
    }
};
