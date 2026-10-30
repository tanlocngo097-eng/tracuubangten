let data = [];

let examSchedule = {
    "10": [],
    "11": [],
    "12": []
};

// ==========================================
// CHUẨN HÓA VĂN BẢN
// ==========================================

function normalizeText(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, " ");
}

// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// ==========================================
// TÊN MÔN HIỂN THỊ
// ==========================================

function getDisplaySubjectName(key) {
    if (
        key === "Giáo dục kinh tế và pháp luật" ||
        key === "GDKT&PL"
    ) {
        return "GDKT&PL";
    }

    return key;
}

// ==========================================
// LẤY LỊCH THI
// ==========================================

function getSubjectSchedule(subjectName, className) {
    const gradeMatch = String(className || "")
        .trim()
        .match(/^(10|11|12)/);

    if (!gradeMatch) return null;

    const grade = gradeMatch[1];
    const schedules = examSchedule[grade] || [];

    return schedules.find(item =>
        normalizeText(item.subject) === normalizeText(subjectName)
    ) || null;
}

// ==========================================
// LẤY SỐ PHÒNG
// ==========================================

function getRoom(value) {
    if (typeof value === "string" || typeof value === "number") {
        return String(value).trim();
    }

    if (value && typeof value === "object" && value.room != null) {
        return String(value.room).trim();
    }

    return "";
}

// ==========================================
// ĐỌC DỮ LIỆU HỌC SINH VÀ LỊCH THI
// ==========================================

async function loadExamData() {
    const result = document.getElementById("result");

    try {
        const [studentResponse, scheduleResponse] = await Promise.all([
            fetch("./examData.json"),
            fetch("./schedule.json")
        ]);

        if (!studentResponse.ok) {
            throw new Error("Không đọc được examData.json");
        }

        if (!scheduleResponse.ok) {
            throw new Error("Không đọc được schedule.json");
        }

        const [studentJSON, scheduleJSON] = await Promise.all([
            studentResponse.json(),
            scheduleResponse.json()
        ]);

        data = Array.isArray(studentJSON)
            ? studentJSON
            : studentJSON.students || [];

        examSchedule = scheduleJSON;

        if (result) {
            result.innerHTML = "";
        }
    } catch (error) {
        console.error(error);

        if (result) {
            result.innerHTML = `
                <div class="not-found">
                    Không đọc được dữ liệu học sinh hoặc lịch thi.
                    Vui lòng tải lại trang sau.
                </div>
            `;
        }
    }
}

// ==========================================
// ĐỊNH DẠNG NGÀY THI
// ==========================================

function formatDate(dateString) {
    if (!dateString) return "Chưa cập nhật";

    const match = String(dateString).match(
        /^(\d{4})-(\d{2})-(\d{2})$/
    );

    if (!match) return dateString;

    return `${match[3]}/${match[2]}/${match[1]}`;
}

// ==========================================
// HIỂN THỊ KẾT QUẢ CỦA MỘT HỌC SINH
// ==========================================

function showStudentResult(student) {
    const result = document.getElementById("result");

    if (!result || !student) return;

    const subjects = [];

    for (const key in student) {
        if (["sbd", "hoTen", "lop"].includes(key)) {
            continue;
        }

        const room = getRoom(student[key]);

        if (!room) continue;

        const displayName = getDisplaySubjectName(key);
        const schedule = getSubjectSchedule(key, student.lop);

        subjects.push({
            key,
            room,
            displayName,
            schedule
        });
    }

    // Sắp xếp theo ngày thi, sau đó theo giờ thi.
    subjects.sort((a, b) => {
        const dateA = a.schedule?.date || "9999-12-31";
        const dateB = b.schedule?.date || "9999-12-31";

        if (dateA !== dateB) {
            return dateA.localeCompare(dateB);
        }

        const timeA = a.schedule?.time || "23:59";
        const timeB = b.schedule?.time || "23:59";

        return timeA.localeCompare(timeB);
    });

    let subjectHTML = "";

    for (const subject of subjects) {
        let scheduleHTML = "";

        if (subject.schedule) {
            scheduleHTML = `
                <div class="exam-time">
                    📅 ${escapeHTML(formatDate(subject.schedule.date))}<br>
                    🕒 ${escapeHTML(
                        subject.schedule.time || "Chưa cập nhật"
                    )}
                </div>
            `;
        }

        subjectHTML += `
            <div class="item">
                <span>${escapeHTML(subject.displayName)}</span><br>
                <strong>📍 Phòng ${escapeHTML(subject.room)}</strong>
                ${scheduleHTML}
            </div>
        `;
    }

    if (!subjectHTML) {
        subjectHTML = `
            <div class="not-found">
                Chưa có thông tin phòng thi của học sinh này.
            </div>
        `;
    }

    result.innerHTML = `
        <div class="card">
            <div class="badge">
                SBD ${escapeHTML(student.sbd)}
            </div>

            <div class="student-heading">
                <h2>${escapeHTML(student.hoTen || "")}</h2>

                <span class="class-badge">
                    ${escapeHTML(student.lop || "")}
                </span>
            </div>

            <div class="grid">
                ${subjectHTML}
            </div>
        </div>
    `;
}

// ==========================================
// HIỂN THỊ DANH SÁCH KHI TRÙNG HỌ TÊN
// ==========================================

function showStudentChoices(students) {
    const result = document.getElementById("result");

    if (!result) return;

    result.innerHTML = `
        <div class="card duplicate-card">
            <div class="duplicate-heading">
                <div>
                    <h2>🔎 Chà Chà... tìm thấy có người trùng tên rồi nè !</h2>
                    <p>Hãy chọn đúng thông tin lớp học của bạn nhé !</p>
                </div>
            </div>

            <div class="student-choices">
                ${students.map((student, index) => `
                    <button
                        type="button"
                        class="student-choice"
                        data-student-index="${index}"
                    >
                        <div class="choice-info">
                            <strong class="choice-name">
                                ${escapeHTML(student.hoTen || "Chưa có họ tên")}
                            </strong>

                            <div class="choice-details">
                                <span>SBD: ${escapeHTML(student.sbd || "Chưa có")}</span>
                                <span class="choice-separator">·</span>
                                <span>Lớp ${escapeHTML(student.lop || "Chưa có")}</span>
                            </div>
                        </div>
                    </button>
                `).join("")}
            </div>
        </div>
    `;

    result.querySelectorAll(".student-choice").forEach(button => {
        button.addEventListener("click", () => {
            const index = Number(button.dataset.studentIndex);
            const student = students[index];

            if (student) {
                showStudentResult(student);
            }
        });
    });
}

// ==========================================
// TRA CỨU BẰNG SBD HOẶC HỌ VÀ TÊN
// ==========================================

function search() {
    const input = document.getElementById("searchInput");
    const result = document.getElementById("result");

    if (!input || !result) return;

    const query = input.value.trim();

    result.innerHTML = "";

    if (!query) {
        result.innerHTML = `
            <div class="not-found">
                Vui lòng nhập số báo danh hoặc họ và tên.
            </div>
        `;
        return;
    }

    if (data.length === 0) {
        result.innerHTML = `
            <div class="not-found">
                Dữ liệu chưa tải xong. Vui lòng thử lại sau.
            </div>
        `;
        return;
    }

    // Ưu tiên tìm chính xác theo SBD.
    const studentBySBD = data.find(student =>
        String(student.sbd || "").trim() === query
    );

    if (studentBySBD) {
        showStudentResult(studentBySBD);
        return;
    }

    // Nếu không khớp SBD, tìm theo họ tên.
    const normalizedQuery = normalizeText(query);

    const matchingStudents = data.filter(student =>
        normalizeText(student.hoTen) === normalizedQuery
    );

    if (matchingStudents.length === 1) {
        showStudentResult(matchingStudents[0]);
        return;
    }

    if (matchingStudents.length > 1) {
        showStudentChoices(matchingStudents);
        return;
    }

    // Không tìm thấy kết quả.
    result.innerHTML = `
        <div class="not-found">
            Không tìm thấy học sinh phù hợp.
            <br>
            Hãy kiểm tra lại SBD hoặc họ và tên.
        </div>
    `;
}

// ==========================================
// NHẤN NÚT TRA CỨU HOẶC ENTER
// ==========================================

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");

if (searchBtn) {
    searchBtn.addEventListener("click", function () {
        search();
    });
}

if (searchInput) {
    searchInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            search();
        }
    });
}

// ==========================================
// TẢI DỮ LIỆU KHI MỞ TRANG
// ==========================================

loadExamData();