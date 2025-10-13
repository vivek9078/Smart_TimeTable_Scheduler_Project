// --- LOCAL STORAGE SETUP ---
const LOCAL_STORAGE_DATA_KEY = 'SmartSchedulerData';
const LAST_EDITED_COURSE_KEY = 'lastEditedCourseId';

let subjects = [];
let teachers = [];
let allCoursesData = []; 
let generatedTimetables = {};

// Helper function to load all data from localStorage
function getAllLocalData() {
    try {
        const data = localStorage.getItem(LOCAL_STORAGE_DATA_KEY);
        return data ? JSON.parse(data) : {};
    } catch (e) {
        console.error("Error retrieving data from localStorage:", e);
        return {};
    }
}

// Helper function to save all data to localStorage
function saveAllLocalData(data) {
    try {
        localStorage.setItem(LOCAL_STORAGE_DATA_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        console.error("Error saving data to localStorage:", e);
        return false;
    }
}

// Function to load data from localStorage and populate the HOD panel fields
async function loadHODData(courseId) {
    if (!courseId) return false;

    const allData = getAllLocalData();
    const data = allData[courseId];

    if (data) {
        // 1. Populate Step 1 (Course Info)
        document.getElementById('courseName').value = data.course || '';
        document.getElementById('branchName').value = data.branch || '';
        document.getElementById('semester').value = data.semester || '';
        document.getElementById('sectionNames').value = (data.sectionNames && data.sectionNames.join(', ')) || '';
        
        // 2. Populate Step 2 (Subjects)
        subjects = data.subjects || [];
        document.getElementById('subjectList').innerHTML = '';
        subjects.forEach(sub => {
            let li = document.createElement('li'); 
            li.textContent = `${sub.name} (${sub.code}) - P${sub.priority} - Type: ${sub.type}`;
            document.getElementById('subjectList').appendChild(li);
        });

        // 3. Populate Step 3 (Teachers)
        teachers = data.teachers || [];
        document.getElementById('teacherList').innerHTML = '';
        teachers.forEach(t => {
            let li = document.createElement('li');
            li.textContent = `${t.name} → ${t.subjects.join(', ')}`;
            document.getElementById('teacherList').appendChild(li);
        });
        
        console.log("HOD data loaded successfully for editing.");
        return true;
    }
    return false;
}

// --- UTILITY & HOD FUNCTIONS ---

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

    document.getElementById('courseName').value = '';
    document.getElementById('branchName').value = '';
    document.getElementById('semester').value = '';
    document.getElementById('sectionNames').value = ''; 
    document.getElementById('subjectName').value = '';
    document.getElementById('subjectCode').value = '';
    document.getElementById('subjectPriority').selectedIndex = 0;
    document.getElementById('subjectType').selectedIndex = 0; 
    document.getElementById('teacherName').value = '';

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

    document.getElementById('timetableStatus').textContent = "(Enter Course and Semester above and click Generate)";
    localStorage.removeItem(LAST_EDITED_COURSE_KEY);
}

window.showPanel = async function(panelId, reset = false) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(panelId).classList.add('active');
    
    if (panelId === 'hodPanel') {
        const lastCourseId = localStorage.getItem(LAST_EDITED_COURSE_KEY);
        
        if (reset || !lastCourseId) {
            resetHODData();
        } else {
            const loaded = await loadHODData(lastCourseId);
            if (!loaded) {
                resetHODData();
            }
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

window.nextStep = function(step) {
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

window.addSubject = function() {
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

window.addTeacher = function() {
    let nameInput = document.getElementById('teacherName');
    let selectedSubjects = Array.from(document.querySelectorAll('#subjectCheckboxes input:checked')).map(cb => cb.value);
    let nameValid = validateInput('teacherName');
    let subjectsValid = selectedSubjects.length > 0;

    const feedbackDiv = document.getElementById('subjectCheckboxesFeedback');
    if (!subjectsValid) {
        feedbackDiv.style.display = 'block';
    } else {
        feedbackDiv.style.display = 'none';
    }

    if (!nameValid || !subjectsValid) return;

    teachers.push({name: nameInput.value, subjects: selectedSubjects});
    
    let li = document.createElement('li');
    li.textContent = `${nameInput.value} → ${selectedSubjects.join(', ')}`;
    document.getElementById('teacherList').appendChild(li);

    nameInput.value = '';
    document.querySelectorAll('#subjectCheckboxes input').forEach(cb => cb.checked = false);
    feedbackDiv.style.display = 'none';
}

window.finishHOD = async function() {
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
    
    // Load existing data, add new entry, and save back to localStorage
    const allData = getAllLocalData();
    allData[docId] = dataToSave;

    if (saveAllLocalData(allData)) {
        console.log("HOD Data saved successfully to localStorage with ID:", docId);
        alert("✅ All HOD data saved successfully!");
        
        // Save the current course ID to localStorage for next session load
        localStorage.setItem(LAST_EDITED_COURSE_KEY, docId); 
        
        resetHODData();
        showPanel('loginPanel');
    } else {
         alert("Error: Failed to save data to local storage. Your browser may be full or blocking storage.");
    }
}

// --- ADMIN PANEL & DATA READ (LOCAL STORAGE) ---

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

window.handleGenerateTimetable = async function() {
    const courseBranchInput = document.getElementById('adminCourseInput');
    const semesterInput = document.getElementById('adminSemesterInput');
    const loadingIndicator = document.getElementById('loadingIndicator');
    const timetableStatus = document.getElementById('timetableStatus');

    const courseBranch = courseBranchInput.value;
    const semester = semesterInput.value;

    if (!courseBranch || !semester) {
        timetableStatus.textContent = "Please enter the Course/Branch and Semester.";
        return;
    }
    
    const selectedCourseData = allCoursesData.find(c => 
        c.courseBranch === courseBranch && 
        c.semester.toString() === semester.toString()
    );

    if (!selectedCourseData) {
        timetableStatus.textContent = `Error: No course data found for ${courseBranch}, Semester ${semester}.`;
        return;
    }

    loadingIndicator.style.display = 'block';
    timetableStatus.textContent = `Generating Timetables for all sections (${selectedCourseData.sectionNames.join(', ')})...`;
    
    await new Promise(resolve => setTimeout(resolve, 1500)); 
    generatedTimetables = generateTimetable(selectedCourseData);

    if (Object.keys(generatedTimetables).length > 1) {
        renderMultiTimetable(generatedTimetables, courseBranch, semester);
        loadingIndicator.style.display = 'none';
        timetableStatus.textContent = `✅ Timetables generated for ${selectedCourseData.sectionNames.length} sections.`;
    } else {
         loadingIndicator.style.display = 'none';
         timetableStatus.textContent = `Error: Could not generate a valid timetable. Try adjusting teacher assignments and period requirements.`;
    }
}


// --- CORE SCHEDULING LOGIC (STRICT GLOBAL LOCK FOR MULTI-SECTION AVOIDANCE) ---

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const SLOTS = ["08:00-08:55", "08:55-09:50", "10:10-11:05", "11:05-12:00", "12:00-12:55", "12:55-01:50", "02:10-03:05", "03:05-04:00", "04:00-04:55", "04:55-05:50"];

const MAX_CONSECUTIVE_CLASSES = 3; 

const PERIOD_REQUIREMENTS = {
    '1': { Theory: 3, Lab: 2 }, 
    '2': { Theory: 2, Lab: 1 }, 
    '3': { Theory: 1, Lab: 1 }  
};

const LAB_SLOT_SIZE = 2; 

function generateTimetable(courseData) {
    const sectionLabels = courseData.sectionNames;
    
    let teacherAvailability = {}; 
    let timetable = {};        
    let schedulingQueue = []; 
    let outputTimetables = { sections: sectionLabels }; 
    
    // 1. Initialization
    sectionLabels.forEach(section => {
        timetable[section] = {};
        DAYS.forEach(day => {
            timetable[section][day] = Array(SLOTS.length).fill('Free');
        });
        outputTimetables[section] = timetable[section];
    });
    
    // Initialize all teachers as available in all slots
    courseData.teachers.forEach(t => {
        teacherAvailability[t.name] = {};
        DAYS.forEach(day => SLOTS.forEach(slot => {
            teacherAvailability[t.name][`${day}_${slot}`] = true;
        }));
    });
    
    // 2. Populate Scheduling Queue with ALL periods from ALL sections
    courseData.subjects.forEach(sub => {
        const req = PERIOD_REQUIREMENTS[sub.priority];
        const isLab = (sub.type === 'Lab');
        const periods = isLab ? req.Lab : req.Theory;

        sectionLabels.forEach(section => {
            // Find the assigned teacher for this specific subject
            const primaryTeacher = courseData.teachers.find(t => t.subjects.includes(sub.name));

            for (let i = 0; i < periods; i++) {
                schedulingQueue.push({ 
                    code: sub.code, 
                    name: sub.name, 
                    priority: parseInt(sub.priority),
                    type: sub.type,
                    section: section, 
                    isMultiSlot: isLab,
                    primaryTeacher: primaryTeacher ? primaryTeacher.name : 'Unassigned' // Store the assigned teacher
                });
            }
        });
    });
    
    // Sort the queue: Highest Priority (1) first (OS Priority Scheduling)
    schedulingQueue.sort((a, b) => a.priority - b.priority);

    // --- 3. Scheduling Loop ---
    let maxTries = 20000; // Increased tries for high constraint multi-section scheduling
    let tries = 0;

    while (schedulingQueue.length > 0 && tries < maxTries) {
        tries++;
        const task = schedulingQueue.shift();
        
        const primaryTeacherName = task.primaryTeacher;
        
        if (primaryTeacherName === 'Unassigned') {
            console.warn(`Skipping task ${task.code} for ${task.section}: No teacher assigned.`);
            continue;
        }

        let scheduled = false;
        const shuffledDays = [...DAYS].sort(() => 0.5 - Math.random());

        for (const day of shuffledDays) {
            for (let i = 0; i < SLOTS.length; i++) {
                const slot = SLOTS[i];
                const slotsRequired = task.isMultiSlot ? LAB_SLOT_SIZE : 1;
                
                // Check 1: Teacher Availability (Shared Resource Lock - Global Check)
                let teacherAvailable = true;
                for (let j = 0; j < slotsRequired; j++) {
                    const currentSlotKey = `${day}_${SLOTS[i+j]}`;
                    if (i + j >= SLOTS.length || !teacherAvailability[primaryTeacherName][currentSlotKey]) {
                        teacherAvailable = false;
                        break;
                    }
                }
                if (!teacherAvailable) continue; // If busy globally (with any other section), move on.

                // Check 2: Student Section Availability (Mutual Exclusion)
                let studentFree = true;
                for (let j = 0; j < slotsRequired; j++) {
                    if (i + j >= SLOTS.length || timetable[task.section][day][i + j] !== 'Free') {
                        studentFree = false;
                        break;
                    }
                }
                if (!studentFree) continue;

                // Check 3: Consecutivity Constraint Check
                let consecutiveCount = 0;
                for (let k = 1; k <= MAX_CONSECUTIVE_CLASSES; k++) {
                    const prevSlotIndex = i - k;
                    if (prevSlotIndex >= 0 && timetable[task.section][day][prevSlotIndex] !== 'Free' && timetable[task.section][day][prevSlotIndex] !== '') {
                        consecutiveCount++;
                    } else {
                        break;
                    }
                }
                if (consecutiveCount >= MAX_CONSECUTIVE_CLASSES) continue;

                // --- Allocation Successful ---
                const teacherInitial = primaryTeacherName.split(' ')[0][0];
                const content = `[${task.code}] ${task.name} (${teacherInitial})`;
                
                // Book Teacher (Global Lock) and Student (Local Lock) for all required slots
                for (let j = 0; j < slotsRequired; j++) {
                    const currentSlotKey = `${day}_${SLOTS[i+j]}`;
                    teacherAvailability[primaryTeacherName][currentSlotKey] = false; // LOCKS THE PRIMARY TEACHER GLOBALLY
                    timetable[task.section][day][i + j] = content; // Book student section
                }
                
                scheduled = true;
                break; 
            }
            if (scheduled) break;
        }
        
        if (!scheduled) {
            // If failed, put the task back into the queue for Round Robin attempt.
            schedulingQueue.push(task); 
        }
    }
    
    return outputTimetables; 
}


// FIX 1: Refined Rendering Logic
function renderMultiTimetable(allTimetables, courseBranch, semester) {
    const sections = allTimetables.sections;
    const tabsContainer = document.getElementById('sectionTabs');
    const contentContainer = document.getElementById('sectionTabContent');
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    sections.forEach((section, index) => {
        const isActive = index === 0;
        const tabId = `tab-${section}`;
        const paneId = `pane-${section}`;

        // Create Tab (Slide)
        tabsContainer.innerHTML += `
            <li class="nav-item" role="presentation">
                <button class="nav-link ${isActive ? 'active' : ''} text-white" id="${tabId}" data-bs-toggle="tab" data-bs-target="#${paneId}" type="button" role="tab" aria-controls="${paneId}" aria-selected="${isActive}">
                    Section ${section}
                </button>
            </li>`;

        // Create Tab Pane (Content Slide)
        const pane = document.createElement('div');
        pane.classList.add('tab-pane', 'fade', 'bg-dark', 'p-3', isActive ? 'show' : '', isActive ? 'active' : '');
        pane.id = paneId;
        pane.setAttribute('role', 'tabpanel');
        pane.setAttribute('aria-labelledby', tabId);
        
        pane.innerHTML = generateTableHTML(allTimetables[section]);
        contentContainer.appendChild(pane);
    });
}

function generateTableHTML(timetable) {
    const tableHTML = `
        <div class="table-responsive mt-3">
            <table class="table table-bordered text-white">
                <thead id="timetableHeader">
                    <tr><th>Day/Time</th>${SLOTS.map(slot => `<th>${slot}</th>`).join('')}</tr>
                </thead>
                <tbody>
                    ${DAYS.map(day => {
                        let row = `<tr><td>${day}</td>`;
                        let lastScheduledIndex = -1;
                        
                        for(let i = SLOTS.length - 1; i >= 0; i--) {
                            if (timetable[day][i] !== 'Free') {
                                lastScheduledIndex = i;
                                break;
                            }
                        }
                        
                        let firstScheduledIndex = SLOTS.length; 
                        for(let i = 0; i < SLOTS.length; i++) {
                            if (timetable[day][i] !== 'Free') {
                                firstScheduledIndex = i;
                                break;
                            }
                        }

                        // Render slots
                        timetable[day].forEach((slotContent, i) => {
                            let displayContent = slotContent;
                            let cellStyle = '';
                            
                            if (slotContent === 'Free') {
                                // Logic: Only mark "Free" if it occurs BETWEEN the first and last scheduled classes.
                                if (i > lastScheduledIndex || i < firstScheduledIndex) {
                                    // Slots BEFORE the first class, or AFTER the last class -> BLANK (End of Day/Start of Day)
                                    displayContent = ''; 
                                } else {
                                    // Slots BETWEEN the first and last class -> EXPLICIT BREAK
                                    displayContent = 'Free'; 
                                    cellStyle = 'opacity: 0.5; font-style: italic;';
                                }
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


// --- DOWNLOAD FUNCTION (FIXED FOR CSV/EXCEL FORMATTING) ---
window.downloadTimetable = function() {
    const course = document.getElementById('adminCourseInput').value;
    const semester = document.getElementById('adminSemesterInput').value;
    
    if (!course || !semester || Object.keys(generatedTimetables).length <= 1) {
        alert("Please generate the timetable first.");
        return;
    }

    let csvs = [];

    // Generate CSV for each section
    generatedTimetables.sections.forEach(section => {
        const timetable = generatedTimetables[section];
        
        // Start of CSV file content
        let csvContent = `Course,${course}\nSemester,${semester}\nSection,${section}\n\n`;
        
        // Headers
        csvContent += `Day/Time,` + SLOTS.join(',') + '\n';

        DAYS.forEach(day => {
            let rowData = [day];
            let lastScheduledIndex = -1;
            let firstScheduledIndex = SLOTS.length;
            
            // Find start and end of active schedule block for display logic
            for(let i = SLOTS.length - 1; i >= 0; i--) {
                if (timetable[day][i] !== 'Free') {
                    lastScheduledIndex = i;
                    break;
                }
            }
            for(let i = 0; i < SLOTS.length; i++) {
                if (timetable[day][i] !== 'Free') {
                    firstScheduledIndex = i;
                    break;
                }
            }

            timetable[day].forEach((slotContent, i) => {
                let displayContent = slotContent;
                
                if (slotContent === 'Free') {
                    // Apply the 'Free' vs. Blank logic
                    displayContent = (i > lastScheduledIndex || i < firstScheduledIndex) ? '' : 'Free';
                }
                
                // Remove quotes and commas from data cells to prevent CSV parsing issues
                rowData.push(`"${displayContent.replace(/"/g, '""').replace(/,/g, '')}"`);
            });
            csvContent += rowData.join(',') + '\n';
        });
        csvs.push({ filename: `Timetable_${course.replace(/\s/g, '-')}_${section}_Sem${semester}.csv`, content: csvContent });
    });
    
    // Combine all CSVs into one big downloadable file (CSV format)
    let combinedCsvContent = "";
    csvs.forEach(file => {
        // Add a clear separator for each section's timetable
        combinedCsvContent += `\n\n========================================================\n`;
        combinedCsvContent += `START_OF_SECTION, ${file.filename.replace('.csv', '')}\n`;
        combinedCsvContent += `========================================================\n\n`;
        combinedCsvContent += file.content;
    });

    // Use 'text/csv' for better compatibility with Excel/Sheets, but the content is structured for readability.
    const blob = new Blob([combinedCsvContent], { type: 'text/csv;charset=utf-8;' }); 
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `Timetables_ALL_Sections_${course.replace(/\s/g, '-')}_Sem${semester}.csv`);
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert(`Download initiated for all ${generatedTimetables.sections.length} timetables (combined into one CSV file).`);
    URL.revokeObjectURL(url);
}
