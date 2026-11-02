import { initializeApp } from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged
} from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKtWvElYaOj3QrVqXq_okvk5lsZnbpLhg",
  authDomain: "student-submission-porta-87f19.firebaseapp.com",
  projectId: "student-submission-porta-87f19",
  storageBucket: "student-submission-porta-87f19.firebasestorage.app",
  messagingSenderId: "525364895472",
  appId: "1:525364895472:web:4f7273f6e33f6404252c35"
};

const ADMIN_UID = "gsxU7DtVn2SvvpypTPkE3TLYwiE2";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
  // test to add dummy files
 window.testFirestoreDB = db;
console.log("Test database exposed:", window.testFirestoreDB);
const provider = new GoogleAuthProvider();

const $ = id => document.getElementById(id);

let currentUser = null;
  let activeClasses = [];
let selectedClass = null;
let teacherSettings = {
  email: {
    teacherSubmissionMode: "never",
    dailySummaryTime: "16:00",
    studentReceiptEnabled: true,
    studentStatusEmailEnabled: true
  },
  display: {
    classColors: {},
    statusColors: {
      new: "#3b82f6",
      reviewed: "#8b5cf6",
      resolved: "#10b981",
      needs_correction: "#f97316"
    },
    inboxLayout: "expanded"
  }
};

const DEFAULT_STATUS_COLORS = {
  new: "#3b82f6",
  reviewed: "#8b5cf6",
  resolved: "#10b981",
  needs_correction: "#f97316"
};

  /*  was for local storage of classes, now saving as variable in firebase
  function getRecentClassIds() {
  try {
    return JSON.parse(
      localStorage.getItem("recentClasses_" + currentUser.uid) || "[]"
    );
  } catch {
    return [];
  }
}

function rememberRecentClass(classId) {
  const recent = getRecentClassIds().filter(id => id !== classId);
  recent.unshift(classId);

  localStorage.setItem(
    "recentClasses_" + currentUser.uid,
    JSON.stringify(recent.slice(0, 10))
  );
}

  function getRecentTeacherEmails() {
  try {
    return JSON.parse(
      localStorage.getItem("recentTeachers_" + currentUser.uid) || "[]"
    );
  } catch {
    return [];
  }
}

function rememberRecentTeacher(email) {
  if (!currentUser || !email) return;

  const recent = getRecentTeacherEmails()
    .filter(item => item !== email);

  recent.unshift(email);

  localStorage.setItem(
    "recentTeachers_" + currentUser.uid,
    JSON.stringify(recent.slice(0, 10))
  );
}
*/
// ------------------------------
// SIGN IN / SIGN OUT
// ------------------------------

$("signIn").addEventListener("click", async () => {
  $("accessError").hidden = true;
  $("status").textContent = "Opening Google sign-in...";

  console.log("Starting Google sign-in...");

  try {
    const result = await signInWithPopup(auth, provider);

    console.log("Google sign-in succeeded:", result.user);
    $("status").textContent =
      "Google sign-in succeeded. Loading your account...";

  } catch (error) {
    console.error("Google sign-in failed:", error);

    $("status").textContent =
      "Sign-in error: " + error.code + "\n" + error.message;
  }
});

$("signOut").addEventListener("click", () => signOut(auth));

// ------------------------------
// DASHBOARDS
// ------------------------------

function hideDashboards() {
  $("teacherDashboard").classList.add("hidden");
  $("teacherMainView").classList.remove("hidden");
  $("classManagementView").classList.add("hidden");
  $("teacherSettingsView").classList.add("hidden");
  
  $("studentDashboard").classList.add("hidden");
  $("adminDashboard").classList.add("hidden");
}

function showDashboard(role) {
  hideDashboards();

  const dashboard = {
    admin: "adminDashboard",
    teacher: "teacherDashboard",
    student: "studentDashboard"
  };

  if (dashboard[role]) {
    $(dashboard[role]).classList.remove("hidden");
  }
}

// ------------------------------
// USER REGISTRATION / AUTHORIZATION
// ------------------------------

async function registerOrLoadUser(user) {
  if (!user.email || !user.emailVerified) {
    throw new Error("A verified Google email is required.");
  }

  const email = user.email.toLowerCase();
  const userRef = doc(db, "users", user.uid);

  if (user.uid === ADMIN_UID) {
    const existing = await getDoc(userRef);

    if (!existing.exists()) {
      throw new Error("Administrator profile is missing.");
    }

    return existing.data();
  }

  let role;
if (email === "iloovepi@gmail.com") {
  role = "teacher";
}else if (email.endsWith("@leanderisd.org")) {
    role = "teacher";
  } else if (email.endsWith("@k12.leanderisd.org")) {
    role = "student";
// all gmail accounts are students
    } else if (email.endsWith("@gmail.com")) {
    role = "student";
  } else {
    throw new Error(
      "This Google account is not authorized for the portal."
    );
  }

  const existing = await getDoc(userRef);

  if (existing.exists()) {
    const data = existing.data();

    if (data.role !== role || data.status !== "active") {
      throw new Error(
        "Your account is not currently authorized."
      );
    }

    return data;
  }

  const profile = {
    email,
    role,
    status: "active",
    displayName: user.displayName || "",
    createdAt: serverTimestamp()
  };

  await setDoc(userRef, profile);

  return profile;
}

// ------------------------------
// CLASS MANAGEMENT
// ------------------------------

async function loadClasses() {
  if (!currentUser) return;

  const list = $("classList");
  list.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "empty-message";
  loading.textContent = "Loading classes...";
  list.appendChild(loading);

  try {
    const classesQuery = query(
      collection(db, "classes"),
      where("teacherId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(classesQuery);

    list.replaceChildren();

    if (snapshot.empty) {
      const empty = document.createElement("p");
      empty.className = "empty-message";
      empty.textContent =
        "You haven't created any classes yet.";
      list.appendChild(empty);
      return;
    }

    const classes = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    classes.sort((a, b) => {
      return (a.name || "").localeCompare(b.name || "");
    });

    for (const classData of classes) {
      renderClass(classData);
    }

  } catch (error) {
    console.error("Unable to load classes:", error);

    list.replaceChildren();

    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent =
      "Unable to load classes: " + error.message;

    list.appendChild(message);
  }
}

function renderClass(classData) {
  const item = document.createElement("div");
  item.className = "class-item";

  if (!classData.active) {
    item.classList.add("inactive");
  }

  const top = document.createElement("div");
  top.className = "class-item-top";

  const heading = document.createElement("h3");
  heading.textContent =
    classData.name + " — Period " + classData.period;

  const status = document.createElement("span");
  status.className =
    "class-status" + (classData.active ? "" : " inactive");

  status.textContent =
    classData.active ? "ACTIVE" : "INACTIVE";

  top.append(heading, status);

  const fields = document.createElement("div");
  fields.className = "class-fields";

  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Class name";

  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.maxLength = 80;
  nameInput.value = classData.name || "";
  nameInput.required = true;

  nameLabel.appendChild(nameInput);

  const periodLabel = document.createElement("label");
  periodLabel.textContent = "Period";

  const periodInput = document.createElement("input");
  periodInput.type = "text";
  periodInput.maxLength = 30;
  periodInput.value = classData.period || "";
  periodInput.required = true;

  periodLabel.appendChild(periodInput);

  fields.append(nameLabel, periodLabel);

  const actions = document.createElement("div");
  actions.className = "class-actions";

  const saveButton = document.createElement("button");
  saveButton.type = "button";
  saveButton.textContent = "Save Changes";

  saveButton.addEventListener("click", async () => {
    const name = nameInput.value.trim();
    const period = periodInput.value.trim();

    if (!name || !period) {
      showClassMessage(
        "Please enter both a class name and period.",
        true
      );
      return;
    }

    saveButton.disabled = true;
    saveButton.textContent = "Saving...";

    try {
      await updateDoc(
        doc(db, "classes", classData.id),
        { name, period }
      );

      showClassMessage("Class updated successfully.");
      await loadClasses();

    } catch (error) {
      console.error("Class update failed:", error);
      showClassMessage(
        "Unable to update class: " + error.message,
        true
      );
      saveButton.disabled = false;
      saveButton.textContent = "Save Changes";
    }
  });

  const toggleButton = document.createElement("button");
  toggleButton.type = "button";
  toggleButton.className =
    classData.active ? "danger" : "secondary";

  toggleButton.textContent =
    classData.active ? "Deactivate" : "Reactivate";

  toggleButton.addEventListener("click", async () => {
    toggleButton.disabled = true;

    try {
      await updateDoc(
        doc(db, "classes", classData.id),
        { active: !classData.active }
      );

      showClassMessage(
        classData.active
          ? "Class deactivated."
          : "Class reactivated."
      );

      await loadClasses();

    } catch (error) {
      console.error("Class status update failed:", error);
      showClassMessage(
        "Unable to change class status: " + error.message,
        true
      );
      toggleButton.disabled = false;
    }
  });

  actions.append(saveButton, toggleButton);

  item.append(top, fields, actions);

  $("classList").appendChild(item);
}

function showClassMessage(message, isError = false) {
  const container = $("classMessage");
  container.replaceChildren();

  const text = document.createElement("div");
  text.className = isError ? "manager-error" : "";
  text.textContent = message;

  container.appendChild(text);
}


// ------------------------------
// TEACHER SETTINGS
// ------------------------------

function showTeacherSettingsMessage(message, isError = false) {
  const container = $("teacherSettingsMessage");
  container.replaceChildren();

  const element = document.createElement("p");
  element.className = isError ? "submission-error" : "submission-success";
  element.textContent = message;

  container.appendChild(element);
}

async function loadTeacherSettings() {
  if (!currentUser) return;

  showTeacherSettingsMessage("Loading settings...");

  try {
    const settingsRef = doc(
      db,
      "teacherSettings",
      currentUser.uid
    );

    const snapshot = await getDoc(settingsRef);

    if (snapshot.exists()) {
      const saved = snapshot.data();

      teacherSettings = {
        email: {
          ...teacherSettings.email,
          ...(saved.email || {})
        },
        display: {
          ...teacherSettings.display,
          ...(saved.display || {}),
          classColors: {
            ...teacherSettings.display.classColors,
            ...(saved.display?.classColors || {})
          },
          statusColors: {
            ...DEFAULT_STATUS_COLORS,
            ...(saved.display?.statusColors || {})
          }
        }
      };
    }

    populateTeacherSettings();
    showTeacherSettingsMessage("");

  } catch (error) {
    console.error("Unable to load teacher settings:", error);
    showTeacherSettingsMessage(
      "Unable to load settings: " + error.message,
      true
    );
  }
}

function populateTeacherSettings() {
  $("teacherSubmissionMode").value =
    teacherSettings.email.teacherSubmissionMode;

  $("dailySummaryTime").value =
    teacherSettings.email.dailySummaryTime || "16:00";

  setSettingsToggle(
    "studentReceiptEnabled",
    teacherSettings.email.studentReceiptEnabled !== false,
    "Student submission receipts"
  );

  setSettingsToggle(
    "studentStatusEmailEnabled",
    teacherSettings.email.studentStatusEmailEnabled !== false,
    "Student status-change emails"
  );

  $("inboxLayout").value =
    teacherSettings.display.inboxLayout || "expanded";

  updateDailySummaryTimeVisibility();
  renderClassColorSettings();
  renderStatusColorSettings();
  updateDailySummaryTimeDisplay();
}

function setSettingsToggle(id, enabled, label) {
  const button = $(id);
  button.setAttribute("aria-pressed", String(enabled));
  button.textContent = `${label}: ${enabled ? "On" : "Off"}`;
}

function updateDailySummaryTimeVisibility() {
  $("dailySummaryTimeContainer").classList.toggle(
    "hidden",
    $("teacherSubmissionMode").value !== "daily"
  );
}

function updateDailySummaryTimeDisplay() {
  const value = $("dailySummaryTime").value || "16:00";
  const [hours, minutes] = value.split(":").map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);

  $("dailySummaryTimeDisplay").textContent =
    date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit"
    });
}

function updateColorRowPreview(input) {
  const row = input.closest(".settings-color-row");
  if (!row) return;

  row.style.borderLeft = `8px solid ${input.value}`;
  row.style.backgroundColor = `${input.value}22`;
}

function renderClassColorSettings() {
  const container = $("classColorSettings");
  container.replaceChildren();

  const classes = [...activeClasses]
    .sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );

  if (classes.length === 0) {
    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent = "You haven't created any classes yet.";
    container.appendChild(message);
    return;
  }

  classes.forEach(classData => {
    const row = document.createElement("div");
    row.className = "settings-color-row";

    const label = document.createElement("label");
    label.textContent =
      `${classData.name} — Period ${classData.period}`;

    const color = document.createElement("input");
    color.type = "color";
    color.className = "settings-color-input";
    color.dataset.classId = classData.id;
    color.value =
      teacherSettings.display.classColors[classData.id] || "#293650";

    row.append(label, color);
    updateColorRowPreview(color);
    container.appendChild(row);
  });
}

function renderStatusColorSettings() {
  const container = $("statusColorSettings");
  container.replaceChildren();

  const labels = {
    new: "New",
    reviewed: "Reviewed",
    resolved: "Resolved",
    needs_correction: "Needs correction"
  };

  Object.entries(labels).forEach(([status, labelText]) => {
    const row = document.createElement("div");
    row.className = "settings-color-row";

    const label = document.createElement("label");
    label.textContent = labelText;

        const color = document.createElement("input");
    color.type = "color";
    color.className = "settings-color-input";
    color.dataset.status = status;
    color.value =
      teacherSettings.display.statusColors[status] ||
      DEFAULT_STATUS_COLORS[status];

    row.append(label, color);
    updateColorRowPreview(color);
    container.appendChild(row);
  });
}



function applyTeacherDisplaySettings() {
  // Apply status colors to badges.
  document.querySelectorAll(".status-badge").forEach(badge => {
    const status = [...badge.classList]
      .find(name => name.startsWith("status-") && name !== "status-badge")
      ?.replace("status-", "");

    const color = teacherSettings.display.statusColors[status];

    if (color) {
      badge.style.color = color;
      badge.style.backgroundColor = color + "26";
      badge.style.borderColor = color + "80";
    }
  });

  // Apply class colors to teacher submission cards.
  document.querySelectorAll("#submissionInbox .submission-card")
    .forEach(card => {
      const submissionId = card.dataset.submissionId;

      const submission = teacherSubmissions.find(
        item => item.id === submissionId
      );

      if (!submission) return;

      const color =
        teacherSettings.display.classColors[submission.classId];

      card.style.borderLeft =
        color ? `5px solid ${color}` : "";
    });

  // Apply compact or expanded layout.
  $("submissionInbox").classList.toggle(
    "compact-layout",
    teacherSettings.display.inboxLayout === "compact"
  );
}

let settingsSaveTimer = null;

async function saveTeacherSettings() {
  if (!currentUser) return;

  const classColors = {};

  document.querySelectorAll(
    "#classColorSettings input[data-class-id]"
  ).forEach(input => {
    classColors[input.dataset.classId] = input.value;
  });

  const statusColors = {};

  document.querySelectorAll(
    "#statusColorSettings input[data-status]"
  ).forEach(input => {
    statusColors[input.dataset.status] = input.value;
  });

  const email = {
    teacherSubmissionMode: $("teacherSubmissionMode").value,
    dailySummaryTime: $("dailySummaryTime").value || "16:00",
    studentReceiptEnabled:
      $("studentReceiptEnabled").getAttribute("aria-pressed") === "true",
    studentStatusEmailEnabled:
      $("studentStatusEmailEnabled").getAttribute("aria-pressed") === "true"
  };

  const display = {
    classColors,
    statusColors,
    inboxLayout: $("inboxLayout").value
  };

  teacherSettings = { email, display };

  // Apply the display changes immediately.
  applyTeacherDisplaySettings();

  showTeacherSettingsMessage("Saving settings...");

  try {
    await setDoc(
      doc(db, "teacherSettings", currentUser.uid),
      {
        email,
        display,
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    showTeacherSettingsMessage("Settings saved.");

  } catch (error) {
    console.error("Unable to save teacher settings:", error);

    showTeacherSettingsMessage(
      "Unable to save settings: " + error.message,
      true
    );
  }
}

function queueTeacherSettingsSave() {
  clearTimeout(settingsSaveTimer);

  settingsSaveTimer = setTimeout(() => {
    saveTeacherSettings();
  }, 400);
}

$("teacherSubmissionMode").addEventListener(
  "change",
  () => {
    updateDailySummaryTimeVisibility();
    queueTeacherSettingsSave();
  }
);

$("dailySummaryTime").addEventListener("input", () => {
  updateDailySummaryTimeDisplay();
});

$("dailySummaryTime").addEventListener("change", () => {
  updateDailySummaryTimeDisplay();
  queueTeacherSettingsSave();
});

$("inboxLayout").addEventListener(
  "change",
  queueTeacherSettingsSave
);

$("studentReceiptEnabled").addEventListener("click", () => {
  const button = $("studentReceiptEnabled");
  const enabled = button.getAttribute("aria-pressed") !== "true";

  setSettingsToggle(
    "studentReceiptEnabled",
    enabled,
    "Student submission receipts"
  );

  queueTeacherSettingsSave();
});

$("studentStatusEmailEnabled").addEventListener("click", () => {
  const button = $("studentStatusEmailEnabled");
  const enabled = button.getAttribute("aria-pressed") !== "true";

  setSettingsToggle(
    "studentStatusEmailEnabled",
    enabled,
    "Student status-change emails"
  );

  queueTeacherSettingsSave();
});

$("classColorSettings").addEventListener("change", event => {
  if (event.target.matches("input[data-class-id]")) {
    queueTeacherSettingsSave();
  }
});

$("statusColorSettings").addEventListener("change", event => {
  if (event.target.matches("input[data-status]")) {
    queueTeacherSettingsSave();
  }
});

$("classColorSettings").addEventListener("input", event => {
  if (event.target.matches("input[data-class-id]")) {
    updateColorRowPreview(event.target);
  }
});

$("statusColorSettings").addEventListener("input", event => {
  if (event.target.matches("input[data-status]")) {
    updateColorRowPreview(event.target);
  }
});

$("openTeacherSettings").addEventListener("click", async () => {
  $("teacherMainView").classList.add("hidden");
  $("classManagementView").classList.add("hidden");
  $("teacherSettingsView").classList.remove("hidden");

  await loadClassesForTeacherSettings();
  await loadTeacherSettings();

  window.scrollTo({ top: 0, behavior: "smooth" });
});

async function loadClassesForTeacherSettings() {
  if (!currentUser) return;

  try {
    const classesQuery = query(
      collection(db, "classes"),
      where("teacherId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(classesQuery);

    activeClasses = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

  } catch (error) {
    console.error("Unable to load classes for settings:", error);
  }
}

$("backFromTeacherSettings").addEventListener("click", () => {
  $("teacherSettingsView").classList.add("hidden");
  $("teacherMainView").classList.remove("hidden");

  window.scrollTo({ top: 0, behavior: "smooth" });
});
// ------------------------------
// CREATE CLASS
// ------------------------------

$("classForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser) return;

  const name = $("className").value.trim();
  const period = $("classPeriod").value.trim();

  if (!name || !period) return;

  const button = $("createClassButton");
  button.disabled = true;
  button.textContent = "Creating...";

  try {
    await addDoc(collection(db, "classes"), {
      teacherId: currentUser.uid,
      teacherEmail: currentUser.email.toLowerCase(),
      name,
      period,
      active: true,
      createdAt: serverTimestamp()
    });

    $("classForm").reset();

    showClassMessage("Class created successfully.");

    await loadClasses();

  } catch (error) {
    console.error("Class creation failed:", error);

    showClassMessage(
      "Unable to create class: " + error.message,
      true
    );

  } finally {
    button.disabled = false;
    button.textContent = "Create Class";
  }
});


async function loadStudentClasses() {
  const teacherSelect = $("studentTeacher");
  const classSelect = $("studentClass");

  teacherSelect.replaceChildren();
  classSelect.replaceChildren();

  classSelect.disabled = true;
  $("continueToSubmit").disabled = true;
  selectedClass = null;

  const loading = document.createElement("option");
  loading.value = "";
  loading.textContent = "Loading classes...";
  teacherSelect.appendChild(loading);

  try {
    // Students can only query active classes.
    const classesQuery = query(
      collection(db, "classes"),
      where("active", "==", true)
    );

    const snapshot = await getDocs(classesQuery);

    activeClasses = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    teacherSelect.replaceChildren();

    if (activeClasses.length === 0) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No active classes available";
      teacherSelect.appendChild(option);
      return;
    }


const teachers = [...new Set(
  activeClasses.map(item => item.teacherEmail)
)].filter(Boolean).sort((a, b) => a.localeCompare(b));

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Choose a teacher...";
    teacherSelect.appendChild(placeholder);

    teachers.forEach(email => {
      const option = document.createElement("option");
      option.value = email;
      option.textContent = email;
      teacherSelect.appendChild(option);
    });

    $("studentClassMessage").textContent = "";

  } catch (error) {
    console.error("Unable to load student classes:", error);

    teacherSelect.replaceChildren();

    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Unable to load teachers";
    teacherSelect.appendChild(option);

    $("studentClassMessage").textContent =
      "Error loading classes: " + error.message;
  }
}

  function populatePreviousClasses() {
  const select = $("previousClass");
  select.innerHTML = '<option value="">Select a previously used class</option>';

  const recentClasses = new Map();

  // Sort submissions newest first.
  const sortedSubmissions = [...studentSubmissions].sort((a, b) => {
    const dateA = a.submittedAt?.toMillis?.() || 0;
    const dateB = b.submittedAt?.toMillis?.() || 0;
    return dateB - dateA;
  });

  // Keep only the most recently used submission for each class.
  sortedSubmissions.forEach(submission => {
    if (!recentClasses.has(submission.classId)) {
      recentClasses.set(submission.classId, submission);
    }
  });

  recentClasses.forEach(submission => {
    const activeClass = activeClasses.find(
      item => item.id === submission.classId
    );

    // Only include classes that are currently active.
    if (!activeClass) return;

    const option = document.createElement("option");
    option.value = activeClass.id;
    option.textContent =
      `${activeClass.name} — Period ${activeClass.period} (${activeClass.teacherEmail})`;

    select.appendChild(option);
  });
}


  function selectPreviousClass() {
  const classId = $("previousClass").value;
  if (!classId) return;

  const classData = activeClasses.find(item => item.id === classId);
  if (!classData) return;

  // Select the teacher.
  $("studentTeacher").value = classData.teacherEmail;

  // Load that teacher's classes.
  loadClassesForSelectedTeacher();

  // Select the previously used class.
  $("studentClass").value = classData.id;
  selectStudentClass();
}

function loadClassesForSelectedTeacher() {
  const teacherEmail = $("studentTeacher").value;
  const classSelect = $("studentClass");

  classSelect.replaceChildren();

  $("continueToSubmit").disabled = true;
  selectedClass = null;

  $("selectedClassInfo").textContent =
    "Select a teacher and class to continue.";

  if (!teacherEmail) {
    classSelect.disabled = true;

    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Select a teacher first";
    classSelect.appendChild(option);
    return;
  }

  const classes = activeClasses
    .filter(item => item.teacherEmail === teacherEmail)
    .sort((a, b) =>
      (a.period || "").localeCompare(
        b.period || "",
        undefined,
        { numeric: true }
      )
    );

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose a class...";
  classSelect.appendChild(placeholder);

  classes.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.name + " — Period " + item.period;
    classSelect.appendChild(option);
  });

  classSelect.disabled = false;
}

function selectStudentClass() {
  const classId = $("studentClass").value;

  selectedClass = activeClasses.find(
    item => item.id === classId
  ) || null;

  $("continueToSubmit").disabled = !selectedClass;

  if (selectedClass) {

    $("selectedClassInfo").textContent =
      selectedClass.name +
      " — Period " + selectedClass.period +
      " (" + selectedClass.teacherEmail + ")";
  } else {
    $("selectedClassInfo").textContent =
      "Select a teacher and class to continue.";
  }
}

$("studentTeacher").addEventListener("change", () => {

  loadClassesForSelectedTeacher();
});

$("studentClass").addEventListener(
  "change",
  selectStudentClass
);

$("previousClass").addEventListener("change", selectPreviousClass);
  
$("continueToSubmit").addEventListener("click", () => {
  if (!selectedClass) return;

  $("submissionClassInfo").textContent =
    selectedClass.name +
    " — Period " + selectedClass.period +
    " (" + selectedClass.teacherEmail + ")";

  $("submissionPanel").classList.remove("hidden");
  $("chooseDriveFiles").disabled = false;

  $("submissionPanel").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});


// ------------------------------
// STUDENT SUBMISSIONS
// ------------------------------

  // ------------------------------
// STUDENT SUBMISSION HISTORY
// ------------------------------

let studentSubmissions = [];

function renderStudentHistory() {
  const container = $("studentHistory");
  container.replaceChildren();

  const typeFilter = $("studentHistoryType").value;
  const statusFilter = $("studentHistoryStatus").value;
  const dateFrom = $("studentHistoryDateFrom").value;
  const dateTo = $("studentHistoryDateTo").value;
  const sortOrder = $("studentHistorySort").value;

  let filtered = studentSubmissions.filter(submission => {
    const matchesType =
      typeFilter === "all" || submission.type === typeFilter;

    const matchesStatus =
      statusFilter === "all" || submission.status === statusFilter;

    const timestamp = submission.submittedAt?.toDate?.();

    const date = timestamp
      ? [
          timestamp.getFullYear(),
          String(timestamp.getMonth() + 1).padStart(2, "0"),
          String(timestamp.getDate()).padStart(2, "0")
        ].join("-")
      : "";

    const matchesFrom = !dateFrom || (date && date >= dateFrom);
    const matchesTo = !dateTo || (date && date <= dateTo);

    return matchesType && matchesStatus && matchesFrom && matchesTo;
  });

  filtered.sort((a, b) => {
    const dateA = a.submittedAt?.toMillis?.() || 0;
    const dateB = b.submittedAt?.toMillis?.() || 0;

    return sortOrder === "oldest"
      ? dateA - dateB
      : dateB - dateA;
  });

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = studentSubmissions.length === 0
      ? "You haven't submitted any assignments yet."
      : "No submissions match these filters.";

    container.appendChild(empty);
    return;
  }

  for (const submission of filtered) {
    const card = document.createElement("div");
    card.className = "submission-card";

    const type = document.createElement("span");
    type.className = "submission-type";
    type.textContent = submission.type === "missing"
      ? "MISSING ASSIGNMENT"
      : "COMPLETED WORK";

    const heading = document.createElement("h3");
    heading.textContent =
      submission.assignmentName || "Untitled assignment";

    const classInfo = document.createElement("p");
    classInfo.textContent =
      (submission.className || "Unknown class") +
      " — Period " + (submission.classPeriod || "");

    const submitted = document.createElement("p");
    submitted.className = "submission-meta";
    submitted.textContent =
      "Submitted: " + formatSubmissionDate(submission.submittedAt);

    const status = createStatusBadge(submission.status);

    const statusLabel = document.createElement("p");
    statusLabel.textContent = "Teacher status:";
    statusLabel.appendChild(document.createTextNode(" "));
    statusLabel.appendChild(status);

    card.append(type, heading, classInfo, submitted, statusLabel);

    if (submission.assignedDate) {
      const assigned = document.createElement("p");
      assigned.textContent =
        "Date assigned: " + submission.assignedDate;
      card.appendChild(assigned);
    }

    if (submission.notes) {
      const notes = document.createElement("p");
      notes.textContent = "Your notes: " + submission.notes;
      card.appendChild(notes);
    }

    if (Array.isArray(submission.driveLinks)) {
      submission.driveLinks.forEach((link, index) => {
        try {
          const url = new URL(link);

          if (
            url.protocol === "https:" &&
            ["drive.google.com", "docs.google.com"].includes(url.hostname)
          ) {
            const anchor = document.createElement("a");
            anchor.href = url.href;
            anchor.target = "_blank";
            anchor.rel = "noopener noreferrer";
            anchor.textContent = "Open Drive file " + (index + 1);
            card.appendChild(anchor);
          }
        } catch {
          // Ignore invalid links.
        }
      });
    }

    container.appendChild(card);
  }
  applyTeacherDisplaySettings();
}

async function loadStudentHistory() {
  if (!currentUser) return;

  $("studentHistoryMessage").textContent = "Loading submissions...";

  try {
    const historyQuery = query(
      collection(db, "submissions"),
      where("studentId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(historyQuery);

    studentSubmissions = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    populatePreviousClasses();

    $("studentHistoryMessage").textContent =
      studentSubmissions.length +
      (studentSubmissions.length === 1
        ? " submission found."
        : " submissions found.");

    renderStudentHistory();

  } catch (error) {
    console.error("Unable to load student history:", error);

    $("studentHistoryMessage").textContent =
      "Unable to load history: " + error.message;
  }
}

$("refreshStudentHistory").addEventListener(
  "click",
  loadStudentHistory
);

  [
  "studentHistoryType",
  "studentHistoryStatus",
  "studentHistoryDateFrom",
  "studentHistoryDateTo",
  "studentHistorySort"
].forEach(id => {
  $(id).addEventListener("change", renderStudentHistory);
});

function showSubmissionMessage(message, isError = false) {
  const container = $("submissionMessage");
  container.replaceChildren();

  const messageElement = document.createElement("div");

  messageElement.className = isError
    ? "submission-error"
    : "submission-success";

  messageElement.textContent = message;
  container.appendChild(messageElement);
}


// ADD / REMOVE DRIVE LINKS

function addDriveLinkField(value = "") {
  const container = $("driveLinksList");

  if (container.children.length >= 10) {
    showSubmissionMessage(
      "You can add a maximum of 10 Drive links.",
      true
    );
    return;
  }

  const row = document.createElement("div");
  row.className = "drive-link-row";

  const input = document.createElement("input");
  input.type = "url";
  input.placeholder = "Paste a Google Drive link";
  input.value = value;
  input.setAttribute("aria-label", "Google Drive link");

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.className = "danger";
  removeButton.textContent = "Remove";

  removeButton.addEventListener("click", () => {
    row.remove();
  });

  row.append(input, removeButton);
  container.appendChild(row);
}

$("addDriveLink").addEventListener("click", () => {
  addDriveLinkField();
});


// GOOGLE DRIVE LINK VALIDATION

function getDriveLinks() {
  const inputs = [
    ...$("driveLinksList").querySelectorAll("input")
  ];

  const links = [];

  for (const input of inputs) {
    const value = input.value.trim();

    if (!value) continue;

    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error("One of your Drive links is not a valid URL.");
    }

    const validHost = [
      "drive.google.com",
      "docs.google.com"
    ].includes(url.hostname);

    if (
      url.protocol !== "https:" ||
      !validHost
    ) {
      throw new Error(
        "Please use a Google Drive or Google Docs link."
      );
    }

    links.push(value);
  }

  return links;
}


// CANCEL / RESET

$("cancelSubmission").addEventListener("click", () => {
  $("submissionForm").reset();
  $("driveLinksList").replaceChildren();
  $("submissionMessage").replaceChildren();

  $("submissionPanel").classList.add("hidden");

  $("studentClassMessage").textContent =
    "You can change your selected class above.";

  $("studentDashboard").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});


// SUBMIT TO FIRESTORE

$("submissionForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!currentUser || !selectedClass) {
    showSubmissionMessage(
      "Please sign in and select a class first.",
      true
    );
    return;
  }

  const assignmentName = $("assignmentName").value.trim();
  const assignedDate = $("assignedDate").value;
  const notes = $("submissionNotes").value.trim();
  const type = $("submissionType").value;

  if (!assignmentName) {
    showSubmissionMessage(
      "Please enter the assignment name.",
      true
    );
    return;
  }

  let driveLinks;

  try {
    driveLinks = getDriveLinks();
  } catch (error) {
    showSubmissionMessage(error.message, true);
    return;
  }

  const submitButton = $("submitAssignment");

  submitButton.disabled = true;
  submitButton.textContent = "Submitting...";

  try {
    await addDoc(collection(db, "submissions"), {
      studentId: currentUser.uid,
      studentEmail: currentUser.email.toLowerCase(),
      studentName: currentUser.displayName || "",

      teacherId: selectedClass.teacherId,
      teacherEmail: selectedClass.teacherEmail,

      classId: selectedClass.id,
      className: selectedClass.name,
      classPeriod: selectedClass.period,

      type,
      assignmentName,
      assignedDate,
      notes,
      driveLinks,

      status: "new",
      submittedAt: serverTimestamp()
    });

    $("submissionForm").reset();
    $("driveLinksList").replaceChildren();

    showSubmissionMessage(
      "Your submission was received successfully!"
    );

    
    $("submissionPanel").scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {
    console.error("Submission failed:", error);

    showSubmissionMessage(
      "Unable to submit: " + error.message,
      true
    );

  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Submit";
  }
});


// GDRIVE File Picker

// ------------------------------
// GOOGLE DRIVE PICKER
// ------------------------------

const GOOGLE_PICKER_API_KEY =
  "AIzaSyA1R6Do6rwE-YXKYkL2zdxF3XlUak5DJmY";

const GOOGLE_PICKER_CLIENT_ID =
  "525364895472-hvc0kvjef4vukd1j25kcur58itpujn35.apps.googleusercontent.com";

const GOOGLE_PICKER_PROJECT_NUMBER = "525364895472";

const GOOGLE_DRIVE_SCOPE =
  "https://www.googleapis.com/auth/drive.file";

let pickerConsentGranted = false;

function loadGooglePicker() {
  return new Promise((resolve, reject) => {
    if (!window.gapi) {
      reject(new Error("Google API library did not load."));
      return;
    }

    window.gapi.load("picker", {
      callback: resolve,
      onerror: () => reject(
        new Error("Unable to load Google Drive Picker.")
      )
    });
  });
}

function requestDriveAccessToken() {
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google authorization library did not load."));
      return;
    }

    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_PICKER_CLIENT_ID,
      scope: GOOGLE_DRIVE_SCOPE,

      callback: response => {
        if (response.error) {
          reject(new Error(
            response.error_description || response.error
          ));
          return;
        }

        pickerConsentGranted = true;
        resolve(response.access_token);
      }
    });

    tokenClient.requestAccessToken({
      prompt: pickerConsentGranted ? "" : "consent"
    });
  });
}

async function shareDriveFileWithTeacher(fileId, accessToken) {
  if (!selectedClass?.teacherEmail) {
    throw new Error("Please select a class and teacher first.");
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/permissions?sendNotificationEmail=true&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        type: "user",
        role: "reader",
        emailAddress: selectedClass.teacherEmail
      })
    }
  );

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    throw new Error(
      errorData.error?.message ||
      "Google Drive could not share this file with your teacher."
    );
  }
}

function resetDrivePickerButton() {
  const button = $("chooseDriveFiles");
  button.disabled = false;
  button.textContent = "Choose from Google Drive";
}

function createGooglePicker(accessToken) {
  const picker = new window.google.picker.PickerBuilder()
    .addView(window.google.picker.ViewId.DOCS)
    .addView(new window.google.picker.DocsUploadView())
    .enableFeature(window.google.picker.Feature.MULTISELECT_ENABLED)
    .setOAuthToken(accessToken)
    .setDeveloperKey(GOOGLE_PICKER_API_KEY)
    .setAppId(GOOGLE_PICKER_PROJECT_NUMBER)
    .setCallback(data => {
      const action = data[window.google.picker.Response.ACTION];

      if (action === window.google.picker.Action.PICKED) {
        handleGooglePickerResult(data, accessToken)
          .catch(error => {
            console.error("Drive selection error:", error);
            showSubmissionMessage(
              "Unable to process selected files: " + error.message,
              true
            );
          })
          .finally(resetDrivePickerButton);

      } else {
        resetDrivePickerButton();
      }
    })
    .build();

  picker.setVisible(true);
}

async function handleGooglePickerResult(data, accessToken) {
  const picker = window.google.picker;

  if (data[picker.Response.ACTION] !== picker.Action.PICKED) {
    return;
  }

  const files = data[picker.Response.DOCUMENTS] || [];

  if (files.length === 0) return;

  const container = $("driveLinksList");

  const existingLinks = [
    ...container.querySelectorAll('input[type="url"]')
  ].map(input => input.value.trim());

  const remainingSlots = 10 - container.children.length;

  if (remainingSlots <= 0) {
    showSubmissionMessage(
      "You already have the maximum of 10 Drive links.",
      true
    );
    return;
  }

  const selectedFiles = files.slice(0, remainingSlots);

  if (files.length > remainingSlots) {
    showSubmissionMessage(
      `Only ${remainingSlots} additional file(s) can be attached.`
    );
  } else {
    showSubmissionMessage("Sharing selected files with your teacher...");
  }

  let added = 0;
  const failed = [];

  for (const file of selectedFiles) {
    const fileId = file[picker.Document.ID];
    const fileName = file[picker.Document.NAME] || "Drive file";

    if (!fileId) {
      failed.push(fileName + ": Missing file ID.");
      continue;
    }

    const fileUrl =
      file[picker.Document.URL] ||
      `https://drive.google.com/open?id=${encodeURIComponent(fileId)}`;

    if (existingLinks.includes(fileUrl)) {
      continue;
    }

    try {
      await shareDriveFileWithTeacher(fileId, accessToken);

      addDriveLinkField(fileUrl);
      existingLinks.push(fileUrl);
      added++;

    } catch (error) {
      console.error("Unable to share Drive file:", error);
      failed.push(fileName + ": " + error.message);
    }
  }

if (failed.length > 0) {
  const addedLabel = added === 1 ? "file" : "files";
  const failedLabel = failed.length === 1 ? "file" : "files";

  showSubmissionMessage(
    `${added} ${addedLabel} added. ${failed.length} ${failedLabel} could not be shared. ` +
    failed.join(" "),
    true
  );
} else {
  showSubmissionMessage(
    added > 0
      ? `${added} ${added === 1 ? "file" : "files"} added and shared with your teacher.`
      : "No new files were added."
  );
}
}

$("chooseDriveFiles").addEventListener("click", async () => {
  if (!currentUser || !selectedClass) {
    showSubmissionMessage(
      "Please select a class before choosing Drive files.",
      true
    );
    return;
  }

  const button = $("chooseDriveFiles");

  button.disabled = true;
  button.textContent = "Opening Google Drive...";

  try {
    await loadGooglePicker();

    const accessToken = await requestDriveAccessToken();

    createGooglePicker(accessToken);

  } catch (error) {
    console.error("Google Drive Picker error:", error);

    showSubmissionMessage(
      "Unable to open Google Drive: " + error.message,
      true
    );

    resetDrivePickerButton();
  }
});


  // ------------------------------
// TEACHER SUBMISSION INBOX
// ------------------------------

let teacherSubmissions = [];

const submissionStatuses = [
  { value: "new", label: "New" },
  { value: "reviewed", label: "Reviewed" },
  { value: "resolved", label: "Resolved" },
  { value: "needs_correction", label: "Needs correction" }
];

  function createStatusBadge(status) {
  const badge = document.createElement("span");

  const validStatus = submissionStatuses.some(
    item => item.value === status
  ) ? status : "new";

  const label = submissionStatuses.find(
    item => item.value === validStatus
  ).label;

  badge.className = "status-badge status-" + validStatus;
  badge.textContent = label;

  return badge;
}

function showInboxMessage(message, isError = false) {
  const container = $("submissionInboxMessage");
  container.replaceChildren();

  const element = document.createElement("p");
  element.className = isError ? "submission-error" : "inbox-message";
  element.textContent = message;

  container.appendChild(element);
}

function formatSubmissionDate(timestamp) {
  if (!timestamp || typeof timestamp.toDate !== "function") {
    return "Date unavailable";
  }

  return timestamp.toDate().toLocaleString();
}

async function loadTeacherSubmissions() {
  if (!currentUser) return;

  const inbox = $("submissionInbox");

  inbox.replaceChildren();

  const loading = document.createElement("p");
  loading.className = "empty-message";
  loading.textContent = "Loading submissions...";
  inbox.appendChild(loading);

  try {
    const submissionsQuery = query(
      collection(db, "submissions"),
      where("teacherId", "==", currentUser.uid)
    );

    const snapshot = await getDocs(submissionsQuery);

    teacherSubmissions = snapshot.docs.map(item => ({
      id: item.id,
      ...item.data()
    }));

    teacherSubmissions.sort((a, b) => {
      const dateA = a.submittedAt?.toMillis?.() || 0;
      const dateB = b.submittedAt?.toMillis?.() || 0;
      return dateB - dateA;
    });
    
    populateSubmissionClassFilter();

    renderTeacherSubmissions();

    showInboxMessage(
      teacherSubmissions.length +
      (teacherSubmissions.length === 1
        ? " submission found."
        : " submissions found.")
    );

  } catch (error) {
    console.error("Unable to load submissions:", error);

    inbox.replaceChildren();

    const message = document.createElement("p");
    message.className = "empty-message";
    message.textContent =
      "Unable to load submissions: " + error.message;

    inbox.appendChild(message);
  }
}

function populateSubmissionClassFilter() {
  const select = $("submissionClassFilter");
  const previousValue = select.value;

  select.replaceChildren();

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All classes";
  select.appendChild(allOption);

  const classes = [
    ...new Map(
      teacherSubmissions.map(item => [
        item.classId,
        {
          id: item.classId,
          name: item.className,
          period: item.classPeriod
        }
      ])
    ).values()
  ];

  classes.sort((a, b) =>
    (a.name || "").localeCompare(b.name || "")
  );

  classes.forEach(item => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent =
      item.name + " — Period " + item.period;
    select.appendChild(option);
  });

  if ([...select.options].some(option => option.value === previousValue)) {
    select.value = previousValue;
  }
}
  
function renderTeacherSubmissions() {
  const inbox = $("submissionInbox");
  inbox.replaceChildren();

  const typeFilter = $("submissionTypeFilter").value;
  const statusFilter = $("submissionStatusFilter").value;
  const classFilter = $("submissionClassFilter").value;
  const dateFrom = $("submissionDateFrom").value;
  const dateTo = $("submissionDateTo").value;
  const sortOrder = $("submissionSort").value;

  let filtered = teacherSubmissions.filter(item => {
    const matchesType =
      typeFilter === "all" || item.type === typeFilter;

    const matchesStatus =
      statusFilter === "all" || item.status === statusFilter;

    const matchesClass =
      classFilter === "all" || item.classId === classFilter;

    const timestamp = item.submittedAt?.toDate?.();
    const date = timestamp
      ? timestamp.toLocaleDateString("en-CA")
      : "";

    const matchesFrom = !dateFrom || (date && date >= dateFrom);
    const matchesTo = !dateTo || (date && date <= dateTo);

    return matchesType && matchesStatus && matchesClass &&
      matchesFrom && matchesTo;
  });

  filtered.sort((a, b) => {
    const dateA = a.submittedAt?.toMillis?.() || 0;
    const dateB = b.submittedAt?.toMillis?.() || 0;

    return sortOrder === "oldest"
      ? dateA - dateB
      : dateB - dateA;
  });

  if (filtered.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-message";
    empty.textContent = teacherSubmissions.length === 0
      ? "No student submissions yet."
      : "No submissions match these filters.";

    inbox.appendChild(empty);
    return;
  }

  for (const submission of filtered) {
    renderSubmissionCard(submission);
  }
  applyTeacherDisplaySettings();
}


function renderSubmissionCard(submission) {
  const card = document.createElement("div");
  card.className = "submission-card";
  card.dataset.submissionId = submission.id;

  function makeCell(label, className = "") {
    const cell = document.createElement("div");
    cell.className = "submission-cell" + (className ? " " + className : "");
    cell.dataset.label = label;
    return cell;
  }

  // Type
  const type = makeCell("Type", "cell-type");
  type.textContent = submission.type === "missing"
    ? "MISSING"
    : "COMPLETED";

  // Assignment
  const assignment = makeCell("Assignment", "cell-assignment");
  assignment.textContent = submission.assignmentName || "Untitled assignment";

  // Student
  const student = makeCell("Student", "cell-student");
  const studentName = document.createElement("strong");
  studentName.textContent = submission.studentName || "Name unavailable";

  const studentEmail = document.createElement("small");
  studentEmail.textContent = submission.studentEmail || "Email unavailable";

  student.append(studentName, studentEmail);

  // Class
  const classInfo = makeCell("Class", "cell-class");
  classInfo.textContent =
    (submission.className || "Unknown class") +
    (submission.classPeriod ? " — Period " + submission.classPeriod : "");

  // Submitted date
  const submitted = makeCell("Submitted", "cell-date");
  submitted.textContent = formatSubmissionDate(submission.submittedAt);

  // Details: assigned date, notes, and Drive links
  const details = makeCell("Details", "cell-details");

  if (submission.assignedDate) {
    const assigned = document.createElement("div");
    assigned.textContent = "Assigned: " + submission.assignedDate;
    details.appendChild(assigned);
  }

  if (submission.notes) {
    const notes = document.createElement("div");
    notes.className = "submission-notes";
    notes.textContent = submission.notes;
    details.appendChild(notes);
  }

  if (Array.isArray(submission.driveLinks) && submission.driveLinks.length) {
    const links = document.createElement("div");
    links.className = "submission-links";

    submission.driveLinks.forEach((link, index) => {
      try {
        const url = new URL(link);

        if (
          url.protocol === "https:" &&
          ["drive.google.com", "docs.google.com"].includes(url.hostname)
        ) {
          const anchor = document.createElement("a");
          anchor.href = url.href;
          anchor.target = "_blank";
          anchor.rel = "noopener noreferrer";
          anchor.textContent = "Drive " + (index + 1);
          links.appendChild(anchor);
        } else {
          const invalid = document.createElement("span");
          invalid.textContent = "Invalid link";
          links.appendChild(invalid);
        }
      } catch {
        const invalid = document.createElement("span");
        invalid.textContent = "Invalid link";
        links.appendChild(invalid);
      }
    });

    details.appendChild(links);
  }

  if (!details.childElementCount) {
    details.textContent = "—";
  }

  // Status
  const status = makeCell("Status", "cell-status");

  const statusSelect = document.createElement("select");

  submissionStatuses.forEach(item => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    statusSelect.appendChild(option);
  });

  statusSelect.value = submissionStatuses.some(
    item => item.value === submission.status
  ) ? submission.status : "new";

  const statusDisplay = document.createElement("div");
  statusDisplay.className = "submission-status-display";

  function updateStatusDisplay(value) {
    statusDisplay.replaceChildren(
      createStatusBadge(value)
    );
  }

  updateStatusDisplay(submission.status);

  status.append(statusSelect, statusDisplay);

  // Assemble spreadsheet row
  card.append(
    type,
    assignment,
    student,
    classInfo,
    submitted,
    details,
    status
  );

  statusSelect.addEventListener("change", async () => {
    const previousStatus = submission.status;
    const newStatus = statusSelect.value;

    if (newStatus === previousStatus) return;

    statusSelect.disabled = true;
    statusDisplay.textContent = "Saving...";

    try {
      await updateDoc(
        doc(db, "submissions", submission.id),
        { status: newStatus }
      );

      submission.status = newStatus;

      showInboxMessage("Submission status saved.");
      renderTeacherSubmissions();

    } catch (error) {
      console.error("Unable to update submission:", error);

      statusSelect.value = previousStatus;
      statusSelect.disabled = false;
      updateStatusDisplay(previousStatus);

      showInboxMessage(
        "Unable to save status: " + error.message,
        true
      );
    }
  });

  $("submissionInbox").appendChild(card);
}



// FILTERS AND REFRESH
/* Diagnostic
[
  "refreshSubmissions",
  "submissionTypeFilter",
  "submissionStatusFilter",
  "submissionClassFilter",
  "submissionDateFrom",
  "submissionDateTo",
  "submissionSort"
].forEach(id => {
  const element = $(id);

  console.log(
    `Element check: ${id}`,
    element ? "FOUND" : "MISSING"
  );

  if (element) {
    element.addEventListener("change", renderTeacherSubmissions);
  }
});

$("refreshSubmissions")?.addEventListener(
  "click",
  loadTeacherSubmissions
);
*/

$("refreshSubmissions").addEventListener(
  "click",
  loadTeacherSubmissions
);

$("submissionTypeFilter").addEventListener(
  "change",
  renderTeacherSubmissions
);

$("submissionStatusFilter").addEventListener(
  "change",
  renderTeacherSubmissions
);

//  where did this come from/go???
$("submissionClassFilter").addEventListener("change",renderTeacherSubmissions); 

$("submissionDateFrom").addEventListener(
  "change",
  renderTeacherSubmissions
);

$("submissionDateTo").addEventListener(
  "change",
  renderTeacherSubmissions
);

$("submissionSort").addEventListener(
  "change",
  renderTeacherSubmissions
);


$("openClassManagement").addEventListener("click", () => {
  $("teacherMainView").classList.add("hidden");
  $("classManagementView").classList.remove("hidden");
  loadClasses();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("backToTeacherDashboard").addEventListener("click", () => {
  $("classManagementView").classList.add("hidden");
  $("teacherMainView").classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Open the date picker when clicking anywhere in a date field.
document.addEventListener("click", event => {
  const dateInput = event.target.closest('input[type="date"]');

  if (!dateInput) return;

  if (typeof dateInput.showPicker === "function") {
    try {
      dateInput.showPicker();
    } catch {
      dateInput.focus();
    }
  }
});
  
// ------------------------------
// AUTH STATE
// ------------------------------

onAuthStateChanged(auth, async user => {
  currentUser = user;

  $("dashboard").classList.add("hidden");
  $("loginPanel").classList.remove("hidden");
  $("signOut").classList.toggle("hidden", !user);

  hideDashboards();

  if (!user) {
    $("status").textContent = "";
    return;
  }

  $("status").textContent = "Checking account access...";
  $("accessError").hidden = true;

  try {
    const profile = await registerOrLoadUser(user);

    $("welcome").textContent =
      "Welcome, " +
      (profile.displayName || user.displayName || "User");

    $("accountInfo").textContent = user.email;
    $("roleInfo").textContent =
      "Account type: " + profile.role;

    showDashboard(profile.role);

    $("dashboard").classList.remove("hidden");
    $("loginPanel").classList.add("hidden");
    $("status").textContent = "";

if (profile.role === "teacher") {
  await loadClasses();
  await loadClassesForTeacherSettings();
  await loadTeacherSettings();
  await loadTeacherSubmissions();
}

if (profile.role === "student") {
  await loadStudentClasses();
    await loadStudentHistory();
}

  } catch (error) {
    console.error("Account authorization failed:", error);

    let message =
      error.message || "An unexpected error occurred.";

    if (
      error.code === "permission-denied" ||
      error.code === "firestore/permission-denied" ||
      message.toLowerCase().includes("insufficient permissions")
    ) {
      message =
        "Your Google account was recognized, but the portal could not create or access your account profile. Please contact the portal administrator.";
    }

    $("accessError").replaceChildren();

    const heading = document.createElement("strong");
    heading.textContent = "Access not available";

    const detail = document.createElement("div");
    detail.textContent = message;

    $("accessError").append(heading, detail);
    $("accessError").hidden = false;

    $("status").textContent = "";

    await signOut(auth);
  }
});

