    let token = "";
        let currentUser = { email: "", role: "" };
        let notifiedBookings = new Set(); 
        let checkInterval = null;

        //УВЕДОМЛЕНИЯ
        function showToast(message, type = 'success') {
            const toastContainer = document.getElementById("toastContainer");
            const toastId = "toast-" + Date.now();
            
            let icon = '<i class="bi bi-check-circle-fill text-success me-2"></i>';
            let borderClass = 'border-success';
            
            if (type === 'danger') {
                icon = '<i class="bi bi-exclamation-triangle-fill text-danger me-2"></i>';
                borderClass = 'border-danger';
            } else if (type === 'warning') {
                icon = '<i class="bi bi-clock-history text-warning me-2"></i>';
                borderClass = 'border-warning';
            }

            const html = `
                <div id="${toastId}" class="toast align-items-center bg-white border ${borderClass} shadow" role="alert" aria-live="assertive" aria-atomic="true">
                    <div class="d-flex">
                        <div class="toast-body fw-medium fs-6">
                            ${icon} ${message}
                        </div>
                        <button type="button" class="btn-close me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
                    </div>
                </div>
            `;
            toastContainer.insertAdjacentHTML('beforeend', html);
            const toastElement = document.getElementById(toastId);
            const toast = new bootstrap.Toast(toastElement, { delay: 6000 });
            toast.show();
            
            toastElement.addEventListener('hidden.bs.toast', () => toastElement.remove());
        }

        //ФОРМАТИРОВАНИЕ ДАТ
        function formatBookingTime(startStr, endStr) {
            const start = new Date(startStr);
            const end = new Date(endStr);
            const pad = (num) => String(num).padStart(2, '0');
            const startH = start.getHours();
            const startM = pad(start.getMinutes());
            const endH = end.getHours();
            const endM = pad(end.getMinutes());
            const startDate = `${pad(start.getDate())}.${pad(start.getMonth() + 1)}.${start.getFullYear()}`;
            const endDate = `${pad(end.getDate())}.${pad(end.getMonth() + 1)}.${end.getFullYear()}`;
            if (startDate === endDate) {
                return `${startH}:${startM} - ${endH}:${endM} (${startDate})`;
            } else {
                return `${startH}:${startM} - ${endH}:${endM} (${startDate} - ${endDate})`;
            }
        }

        function formatDateTime(date) {
            const pad = (num) => String(num).padStart(2, '0');
            return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        }

        window.addEventListener('DOMContentLoaded', () => {
            const now = new Date();
            now.setMinutes(Math.ceil(now.getMinutes() / 30) * 30, 0, 0);
            const end = new Date(now.getTime() + 60 * 60 * 1000);
            document.getElementById("start_time").value = formatDateTime(now);
            document.getElementById("end_time").value = formatDateTime(end);
            document.getElementById("end_time").min = formatDateTime(now);
        });

        function validateTimeRange() {
            const start = document.getElementById("start_time").value;
            const end = document.getElementById("end_time").value;
            const endInput = document.getElementById("end_time");
            if (!start || !end) return true;
            if (new Date(start) >= new Date(end)) {
                endInput.classList.add("is-invalid");
                return false; 
            } else {
                endInput.classList.remove("is-invalid");
                return true;
            }
        }

        function updateMinEndTime() {
            const startVal = document.getElementById("start_time").value;
            const endInput = document.getElementById("end_time");
            if (!startVal) return;
            endInput.min = startVal;
            if (endInput.value && endInput.value <= startVal) {
                endInput.value = formatDateTime(new Date(new Date(startVal).getTime() + 3600000));
            }
        }

        //ПРОВЕРКА ПРОСРОЧЕННЫХ БРОНЕЙ
        async function checkExpiredBookings() {
            if (currentUser.role !== "admin" || !token) return;
            
            try {
                const response = await fetch("/bookings/all", { headers: { "Authorization": `Bearer ${token}` } });
                if (!response.ok) return;
                
                const bookings = await response.json();
                const now = new Date();
                let expiredCount = 0;
                let expiredRooms = [];

                bookings.forEach(b => {
                    const endTime = new Date(b.end_time);
                    if (endTime < now && !notifiedBookings.has(b.id)) {
                        notifiedBookings.add(b.id);
                        expiredCount++;
                        expiredRooms.push(b.room.name);
                    }
                });

                if (expiredCount > 0) {
                    const roomsStr = expiredRooms.join(", ");
                    showToast(`Время встречи в "${roomsStr}" истекло. Не забудьте удалить бронь, чтобы освободить комнату!`, 'warning');
                }
            } catch (e) {
                console.error("Ошибка проверки броней", e);
            }
        }

        // АВТОРИЗАЦИЯ
        async function login() {
            const formData = new URLSearchParams();
            formData.append("username", document.getElementById("email").value);
            formData.append("password", document.getElementById("password").value);
            const response = await fetch("/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: formData
            });
            if (response.ok) {
                const data = await response.json();
                token = data.access_token;
                currentUser.email = document.getElementById("email").value;
                currentUser.role = data.role;

                // Меняем экраны
                document.getElementById("login-section").classList.add("d-none");
                document.getElementById("app-section").classList.remove("d-none");
                document.getElementById("main-navbar").classList.remove("d-none");

                // Обновляем данные в профиле
                document.getElementById("user-email-display").innerText = currentUser.email;
                document.getElementById("user-role-display").innerText = currentUser.role;

                if (data.role === "admin") {
                    document.getElementById("admin-section").classList.remove("d-none");
                    
                    checkExpiredBookings(); 
                    if (checkInterval) clearInterval(checkInterval);
                    checkInterval = setInterval(checkExpiredBookings, 60000); 
                }
                showToast("Вы успешно вошли в систему!");
            } else {
                showToast("Ошибка входа. Проверьте пароль.", 'danger');
            }
        }

        function logout() {
            location.reload(); 
        }

        async function findRooms() {
            if (!validateTimeRange()) return; 
            
            const searchBtn = document.getElementById("search-btn");
            const originalText = searchBtn.innerHTML;
            searchBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Поиск...`;
            searchBtn.disabled = true;

            const params = new URLSearchParams({
                participants: document.getElementById("participants").value,
                start: document.getElementById("start_time").value,
                end: document.getElementById("end_time").value,
                equipment: document.getElementById("equipment").value
            });
            const response = await fetch(`/rooms/recommend?${params}`, {
                headers: { "Authorization": `Bearer ${token}` }
            });
            const rooms = await response.json();
            const list = document.getElementById("rooms-list");
            list.innerHTML = "";
            
            searchBtn.innerHTML = originalText;
            searchBtn.disabled = false;

            if (rooms.length === 0) {
                list.innerHTML = `<div class="col-12 text-center py-4 text-muted">
                    <i class="bi bi-emoji-frown fs-1"></i>
                    <p class="mt-2">Нет свободных комнат на это время</p>
                </div>`;
                return;
            }
            
            rooms.forEach(room => {
                const col = document.createElement("div");
                col.className = "col-md-6";
                col.innerHTML = `
                    <div class="border rounded p-3 h-100 d-flex flex-column justify-content-between bg-white shadow-sm">
                        <div>
                            <h5 class="fw-bold mb-1">${room.name}</h5>
                            <p class="text-muted small mb-2">
                                <i class="bi bi-people-fill"></i> до ${room.capacity} чел. <br>
                                <i class="bi bi-tools"></i> ${room.equipment || 'Без оборудования'}
                            </p>
                        </div>
                        <button onclick="bookRoom(${room.id})" class="btn btn-primary btn-sm w-100 mt-2">Забронировать</button>
                    </div>
                `;
                list.appendChild(col);
            });
        }

        async function bookRoom(roomId) {
            if (!validateTimeRange()) return;
            const response = await fetch("/bookings/", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify({
                    room_id: roomId,
                    start_time: document.getElementById("start_time").value,
                    end_time: document.getElementById("end_time").value,
                    participants: parseInt(document.getElementById("participants").value)
                })
            });
            if (response.ok) {
                showToast("Комната успешно забронирована!");
                openMyBookings(); 
            } else {
                const err = await response.json();
                showToast(err.detail || "Ошибка бронирования", 'danger');
            }
        }

        // --- МОИ БРОНИ ---
        async function refreshMyBookingsList() {
            const response = await fetch("/bookings/my", { headers: { "Authorization": `Bearer ${token}` } });
            const bookings = await response.json();
            const container = document.getElementById("my-bookings-list");
            container.innerHTML = "";
            
            if (bookings.length === 0) {
                container.innerHTML = `<div class="text-center py-4 text-muted"><i class="bi bi-calendar-x fs-1"></i><p class="mt-2">У вас пока нет броней</p></div>`;
                return;
            }

            let html = `<div class="accordion" id="myAccordion">`;
            bookings.forEach((b, index) => {
                const timeString = formatBookingTime(b.start_time, b.end_time);
                html += `
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#my-${index}">
                                <span class="fw-bold">${b.room.name}</span>
                                <span class="text-muted ms-3 small">${timeString}</span>
                            </button>
                        </h2>
                        <div id="my-${index}" class="accordion-collapse collapse" data-bs-parent="#myAccordion">
                            <div class="accordion-body bg-light">
                                <div class="row text-muted small mb-3">
                                    <div class="col-6 mb-1"><i class="bi bi-building"></i> Этаж: ${b.room.floor}</div>
                                    <div class="col-6 mb-1"><i class="bi bi-people"></i> Мест: до ${b.room.capacity}</div>
                                    <div class="col-6 mb-1"><i class="bi bi-tools"></i> ${b.room.equipment || 'Нет'}</div>
                                    <div class="col-6 mb-1"><i class="bi bi-person-badge"></i> Участников: ${b.participants}</div>
                                </div>
                                <button onclick="cancelBooking(${b.id})" class="btn btn-outline-danger btn-sm w-100">Отменить бронь</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML = html;
        }

        async function openMyBookings() {
            await refreshMyBookingsList(); 
            bootstrap.Modal.getOrCreateInstance(document.getElementById('myBookingsModal')).show();
        }

        async function cancelBooking(bookingId) {
            if (!confirm("Отменить это бронирование?")) return;
            const response = await fetch(`/bookings/${bookingId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                showToast("Бронь отменена");
                await refreshMyBookingsList(); 
                if (currentUser.role === "admin") {
                    refreshAllBookingsList();
                    refreshAdminRoomsList();
                }
            } else {
                const err = await response.json();
                showToast("Ошибка отмены: " + err.detail, 'danger');
            }
        }

        // --- АДМИН: СОЗДАНИЕ КОМНАТ ---
        async function createRoom() {
            const roomData = {
                name: document.getElementById("new_room_name").value,
                capacity: parseInt(document.getElementById("new_room_capacity").value),
                equipment: document.getElementById("new_room_equipment").value,
                floor: parseInt(document.getElementById("new_room_floor").value)
            };
            const response = await fetch("/rooms/", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
                body: JSON.stringify(roomData)
            });
            if (response.ok) {
                showToast(`Комната "${roomData.name}" создана!`);
                document.getElementById("new_room_name").value = ""; 
                refreshAdminRoomsList();
            } else {
                const err = await response.json();
                showToast("Ошибка: " + err.detail, 'danger');
            }
        }

        // --- АДМИН: УПРАВЛЕНИЕ КОМНАТАМИ ---
        async function refreshAdminRoomsList() {
            const response = await fetch("/rooms/", { headers: { "Authorization": `Bearer ${token}` } });
            const rooms = await response.json();
            const list = document.getElementById("admin-rooms-list");
            list.innerHTML = "";
            
            if (rooms.length === 0) {
                list.innerHTML = "<li class='list-group-item text-center text-muted'>Нет комнат</li>";
                return;
            }
            
            rooms.forEach(room => {
                const li = document.createElement("li");
                li.className = "list-group-item d-flex justify-content-between align-items-center";
                li.innerHTML = `
                    <div>
                        <h6 class="mb-1 fw-bold">${room.name}</h6>
                        <small class="text-muted">ID: ${room.id} | Этаж: ${room.floor} | до ${room.capacity} чел. | ${room.equipment || 'Без оборуд.'}</small>
                    </div>
                    <button onclick="deleteRoom(${room.id})" class="btn btn-sm btn-outline-danger">Удалить</button>
                `;
                list.appendChild(li);
            });
        }

        async function openAdminRooms() {
            await refreshAdminRoomsList();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('adminRoomsModal')).show();
        }

        async function deleteRoom(roomId) {
            if (!confirm("Удалить комнату?")) return;
            const response = await fetch(`/rooms/${roomId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (response.ok) {
                showToast("Комната удалена");
                refreshAdminRoomsList(); 
            } else {
                const err = await response.json();
                showToast("Ошибка: " + err.detail, 'danger');
            }
        }

        // --- АДМИН: ВСЕ БРОНИ ---
        async function refreshAllBookingsList() {
            const response = await fetch("/bookings/all", { headers: { "Authorization": `Bearer ${token}` } });
            const bookings = await response.json();
            const container = document.getElementById("all-bookings-list");
            container.innerHTML = "";
            
            if (bookings.length === 0) {
                container.innerHTML = `<div class="text-center py-4 text-muted"><i class="bi bi-inbox fs-1"></i><p class="mt-2">В системе пока нет броней</p></div>`;
                return;
            }
            let html = `<div class="accordion" id="allAccordion">`;
            bookings.forEach((b, index) => {
                const timeString = formatBookingTime(b.start_time, b.end_time);
                const isExpired = new Date(b.end_time) < new Date();
                const badge = isExpired ? '<span class="badge bg-warning text-dark ms-auto">Просрочено</span>' : '';
                
                html += `
                    <div class="accordion-item">
                        <h2 class="accordion-header">
                            <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#all-${index}">
                                <span class="fw-bold">${b.room.name}</span>
                                <span class="text-muted ms-3 small">${timeString}</span>
                                ${badge}
                                <span class="badge bg-secondary ms-2">Юзер ID: ${b.user_id}</span>
                            </button>
                        </h2>
                        <div id="all-${index}" class="accordion-collapse collapse" data-bs-parent="#allAccordion">
                            <div class="accordion-body bg-light">
                                <div class="row text-muted small mb-3">
                                    <div class="col-6 mb-1"><i class="bi bi-building"></i> Этаж: ${b.room.floor}</div>
                                    <div class="col-6 mb-1"><i class="bi bi-people"></i> Мест: до ${b.room.capacity}</div>
                                    <div class="col-6 mb-1"><i class="bi bi-person-badge"></i> Участников: ${b.participants}</div>
                                    <div class="col-6 mb-1"><i class="bi bi-tools"></i> ${b.room.equipment || 'Нет'}</div>
                                </div>
                                <button onclick="cancelBooking(${b.id})" class="btn btn-danger btn-sm w-100">Удалить бронь</button>
                            </div>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
            container.innerHTML = html;
        }
        async function openAllBookings() {
            await refreshAllBookingsList();
            bootstrap.Modal.getOrCreateInstance(document.getElementById('allBookingsModal')).show();
        }