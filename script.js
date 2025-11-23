// Simple task app with datetime, edit/delete, localStorage persistence and notifications

// DOM
const taskContainer = document.getElementById('taskContainer');
const addBtn = document.getElementById('addBtn');
const taskText = document.getElementById('taskText');
const taskTime = document.getElementById('taskTime');
const priority = document.getElementById('priority');

const modal = document.getElementById('modal');
const editText = document.getElementById('editText');
const editTime = document.getElementById('editTime');
const saveEdit = document.getElementById('saveEdit');
const cancelEdit = document.getElementById('cancelEdit');

let tasks = []; // will hold {id, text, time, priority, done, notified}
let editingId = null;

// utility id generator
const idGen = () => Date.now().toString(36) + Math.random().toString(36).slice(2,8);

// load from storage
function loadTasks(){
  const raw = localStorage.getItem('tasks_v1');
  tasks = raw ? JSON.parse(raw) : [];
  renderTasks();
}

// save storage
function saveTasks(){
  localStorage.setItem('tasks_v1', JSON.stringify(tasks));
}

// create task element
function createTaskEl(task){
  const div = document.createElement('div');
  div.className = 'task';
  if(task.done) div.classList.add('done');
  div.dataset.id = task.id;

  // left: checkbox + meta
  const left = document.createElement('div'); left.className='left';
  const checkbox = document.createElement('div'); checkbox.className='checkbox';
  checkbox.innerHTML = task.done ? '✓' : '';
  checkbox.title = task.done ? 'Mark as undone' : 'Mark as done';
  checkbox.addEventListener('click', () => toggleDone(task.id));
  left.appendChild(checkbox);

  const meta = document.createElement('div'); meta.className='meta';
  const title = document.createElement('div'); title.className='title'; title.textContent = task.text || 'Untitled';
  const time = document.createElement('div'); time.className='time';
  time.textContent = task.time ? new Date(task.time).toLocaleString() : 'No time set';
  meta.appendChild(title); meta.appendChild(time);
  left.appendChild(meta);

  // right: countdown, priority, edit, delete
  const right = document.createElement('div'); right.className='right';
  const countdown = document.createElement('div'); countdown.className='countdown';
  countdown.style.fontSize = '12px';
  countdown.textContent = computeCountdownText(task.time);
  right.appendChild(countdown);

  const chip = document.createElement('div'); chip.className = `chip ${task.priority||'normal'}`; chip.textContent = task.priority || 'normal';
  right.appendChild(chip);

  const editBtn = document.createElement('button'); editBtn.className='action-btn'; editBtn.title='Edit';
  editBtn.innerHTML = '✏️'; editBtn.addEventListener('click', () => openEdit(task.id));
  const delBtn = document.createElement('button'); delBtn.className='action-btn'; delBtn.title='Delete';
  delBtn.innerHTML = '🗑️'; delBtn.addEventListener('click', () => deleteTask(task.id));
  right.appendChild(editBtn); right.appendChild(delBtn);

  div.appendChild(left); div.appendChild(right);

  // keep ref to countdown node for updates
  div._countdownNode = countdown;
  return div;
}

// render all
function renderTasks(){
  taskContainer.innerHTML = '';
  // sort: not done first, then time asc
  tasks.sort((a,b)=>{
    if(a.done !== b.done) return a.done ? 1 : -1;
    if(!a.time && b.time) return 1;
    if(a.time && !b.time) return -1;
    return (new Date(a.time || 0)) - (new Date(b.time || 0));
  });

  tasks.forEach(task => taskContainer.appendChild(createTaskEl(task)));
}

// add
addBtn.addEventListener('click', () => {
  const text = taskText.value.trim();
  if(!text){ alert('Please enter a task'); return; }
  const timeVal = taskTime.value || null;
  const p = priority.value || 'normal';
  const t = { id: idGen(), text, time: timeVal, priority: p, done: false, notified: false };
  tasks.push(t);
  saveTasks();
  renderTasks();
  taskText.value=''; taskTime.value='';
  // scroll to bottom to show latest
  taskContainer.scrollTop = taskContainer.scrollHeight;
});

// toggle done
function toggleDone(id){
  const t = tasks.find(x=>x.id===id); if(!t) return;
  t.done = !t.done;
  saveTasks(); renderTasks();
}

// open edit modal
function openEdit(id){
  editingId = id;
  const t = tasks.find(x=>x.id===id); if(!t) return;
  editText.value = t.text;
  editTime.value = t.time || '';
  modal.classList.remove('hidden');
}

// save edit
saveEdit.addEventListener('click', () => {
  if(!editingId) return;
  const t = tasks.find(x=>x.id===editingId);
  t.text = editText.value.trim() || t.text;
  t.time = editTime.value || null;
  t.notified = false; // reset notification flag when changed
  saveTasks(); renderTasks();
  closeModal();
});

// cancel
cancelEdit.addEventListener('click', closeModal);
function closeModal(){ modal.classList.add('hidden'); editingId = null; }

// delete
function deleteTask(id){
  if(!confirm('Delete this task?')) return;
  tasks = tasks.filter(x=>x.id!==id);
  saveTasks(); renderTasks();
}

// countdown helper (nice short text)
function computeCountdownText(timeStr){
  if(!timeStr) return '';
  const target = new Date(timeStr);
  const now = new Date();
  const diff = target - now;
  if(diff < -60000) return 'Overdue';
  if(diff <= 0) return 'Now';
  const mins = Math.floor(diff/60000);
  if(mins < 60) return `${mins}m`;
  const hours = Math.floor(mins/60);
  if(hours < 24) return `${hours}h ${mins%60}m`;
  const days = Math.floor(hours/24);
  return `${days}d ${hours%24}h`;
}

// live update of countdowns every 30s
setInterval(()=> {
  document.querySelectorAll('.task').forEach(node => {
    const id = node.dataset.id;
    const task = tasks.find(t=>t.id===id);
    if(task && node._countdownNode) node._countdownNode.textContent = computeCountdownText(task.time);
  });
}, 30000);

// notifications: request permission and run check every minute
async function ensureNotificationPermission(){
  if(!('Notification' in window)) return;
  if(Notification.permission === 'default') await Notification.requestPermission();
}
ensureNotificationPermission();

setInterval(() => {
  if(Notification.permission !== 'granted') return;
  const now = new Date();
  const currentMin = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate() + ' ' + now.getHours() + ':' + now.getMinutes();
  tasks.forEach(task => {
    if(task.notified || task.done || !task.time) return;
    const target = new Date(task.time);
    // notify if the same minute or overdue within 1 minute tolerance
    const diff = Math.abs(target - now);
    if(diff < 60000) {
      new Notification('Reminder', { body: `${task.text} — ${target.toLocaleString()}` });
      task.notified = true;
      saveTasks();
    }
  });
}, 60000); // check every minute

// initial load
loadTasks();
