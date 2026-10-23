
"use strict";

const $ = id => document.getElementById(id);
const SAVE_KEY = "dr4kz_money_ultimate_v1";
const ADMIN_CODE = "DR4KZ777";

const DEFAULTS = {
  balance: 0,
  clicks: 0,
  totalEarned: 0,
  power: 1,
  upgradeLevel: 0,
  price: 50,
  autoLevel: 0,
  autoPrice: 250,
  multiplier: 1,
  playerName: "DR4KZ",
  avatar: "😎",
  theme: "purple",
  xp: 0,
  level: 1,
  rebirths: 0,
  permanentBonus: 1,
  dailyDate: "",
  dailyStreak: 0,
  pets: [],
  adminBonus: 0,
  adminAutoOverride: null,
  pricePercent: 100,
  shopEnabled: true,
  maintenance: false
};

let data = loadGame();
let lastAutoTime = Date.now();

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULTS };
    const saved = JSON.parse(raw);
    const result = { ...DEFAULTS, ...saved };

    for (const key of [
      "balance", "clicks", "totalEarned", "power", "upgradeLevel",
      "price", "autoLevel", "autoPrice", "multiplier", "xp", "level",
      "rebirths", "permanentBonus", "dailyStreak", "adminBonus",
      "pricePercent"
    ]) {
      const value = Number(result[key]);
      result[key] = Number.isFinite(value) && value >= 0 ? value : DEFAULTS[key];
    }

    if (!Array.isArray(result.pets)) result.pets = [];
    result.pets = result.pets.filter(id => ["dog", "cat", "dragon"].includes(id));
    if (![1, 2, 5, 10].includes(result.multiplier)) result.multiplier = 1;
    if (!["purple", "blue", "green", "red"].includes(result.theme)) result.theme = "purple";
    if (typeof result.shopEnabled !== "boolean") result.shopEnabled = true;
    if (typeof result.maintenance !== "boolean") result.maintenance = false;

    return result;
  } catch {
    return { ...DEFAULTS };
  }
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    showMessage("Не удалось сохранить игру на устройстве.");
  }
}

function showMessage(message) {
  const el = $("message");
  if (!el) return;
  el.textContent = message;
}

function safeAdd(key, amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) return false;
  if (!Number.isSafeInteger(data[key]) || data[key] > Number.MAX_SAFE_INTEGER - amount) {
    showMessage("Достигнут максимальный лимит.");
    return false;
  }
  data[key] += amount;
  return true;
}

function xpForNextLevel(level = data.level) {
  return Math.min(1000000000, Math.max(100, level * 100));
}

function addXP(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) return;
  if (data.xp > Number.MAX_SAFE_INTEGER - amount) return;

  data.xp += amount;
  while (data.level < 1000000 && data.xp >= xpForNextLevel()) {
    data.xp -= xpForNextLevel();
    data.level++;
    showMessage("Новый уровень: " + data.level + "!");
  }
}

function petBonus() {
  let bonus = 0;
  if (data.pets.includes("dog")) bonus += 2;
  if (data.pets.includes("cat")) bonus += 10;
  if (data.pets.includes("dragon")) bonus += 50;
  return bonus;
}

function clickIncome() {
  return Math.floor(
    (data.power + petBonus() + data.adminBonus) *
    data.multiplier * data.permanentBonus
  );
}

function autoIncome() {
  if (data.adminAutoOverride !== null) return data.adminAutoOverride;
  return data.autoLevel * 5;
}

function earn(amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) return false;
  if (!safeAdd("balance", amount)) return false;
  safeAdd("totalEarned", amount);
  addXP(Math.min(amount, 1000000));
  return true;
}

function price(base) {
  return Math.max(1, Math.floor(base * data.pricePercent / 100));
}

function rankName() {
  if (data.level >= 50) return "Легенда";
  if (data.level >= 25) return "Миллионер";
  if (data.level >= 10) return "Профи";
  if (data.level >= 5) return "Опытный";
  return "Новичок";
}

function render() {
  $("balance").textContent = Math.floor(data.balance).toLocaleString("ru-RU");
  $("clicks").textContent = data.clicks.toLocaleString("ru-RU");
  $("totalEarned").textContent = Math.floor(data.totalEarned).toLocaleString("ru-RU") + " $";
  $("power").textContent = data.power;
  $("upgradePrice").textContent = price(data.price).toLocaleString("ru-RU");
  $("autoPrice").textContent = price(data.autoPrice).toLocaleString("ru-RU");
  $("autoIncome").textContent = autoIncome().toLocaleString("ru-RU");
  $("clickIncome").textContent = clickIncome().toLocaleString("ru-RU");
  $("multiplier").textContent = data.multiplier;
  $("level").textContent = data.level;
  $("xp").textContent = data.xp;
  $("rank").textContent = rankName();
  $("xpBar").style.width = Math.min(100, data.xp / xpForNextLevel() * 100) + "%";
  $("rebirths").textContent = data.rebirths;
  $("rebirthCost").textContent = rebirthCost().toLocaleString("ru-RU");
  $("rebirthBonus").textContent = data.permanentBonus;
  $("playerName").value = data.playerName;
  $("avatarBtn").textContent = data.avatar;
  $("theme").value = data.theme;
  document.body.dataset.theme = data.theme;

  $("buyUpgrade").disabled = !data.shopEnabled || data.balance < price(data.price) || data.maintenance;
  $("buyAuto").disabled = !data.shopEnabled || data.balance < price(data.autoPrice) || data.maintenance;
  $("clickButton").disabled = data.maintenance;
  $("dailyButton").disabled = data.maintenance || claimedToday();
  $("rebirthButton").disabled = data.maintenance || data.balance < rebirthCost();

  $("dailyInfo").textContent = claimedToday()
    ? "Сегодня бонус уже получен. Возвращайся завтра!"
    : "Серия: " + data.dailyStreak + " дн. Следующий бонус доступен сейчас.";

  renderPets();
  document.querySelectorAll("[data-mult]").forEach(button => {
    const m = Number(button.dataset.mult);
    const cost = multiplierCost(m);
    button.disabled = data.maintenance || !data.shopEnabled || data.balance < cost || data.multiplier >= m;
    button.textContent = "×" + m + " — " + cost.toLocaleString("ru-RU") + " $";
  });
}

function renderPets() {
  const container = $("pets");
  container.replaceChildren();

  const catalog = [
    { id: "dog", name: "🐶 Пёс", cost: 1000, bonus: "+2 к клику" },
    { id: "cat", name: "🐱 Кот", cost: 5000, bonus: "+10 к клику" },
    { id: "dragon", name: "🐉 Дракон", cost: 25000, bonus: "+50 к клику" }
  ];

  for (const pet of catalog) {
    const owned = data.pets.includes(pet.id);
    const row = document.createElement("div");
    row.className = "pet";

    const info = document.createElement("div");
    const name = document.createElement("b");
    name.textContent = pet.name;
    const desc = document.createElement("div");
    desc.className = "muted";
    desc.textContent = owned ? "Уже куплен" : pet.bonus + " · " + pet.cost.toLocaleString("ru-RU") + " $";
    info.append(name, desc);

    const button = document.createElement("button");
    button.textContent = owned ? "Куплен" : "Купить";
    button.disabled = owned || !data.shopEnabled || data.maintenance || data.balance < price(pet.cost);
    button.addEventListener("click", () => {
      if (owned || !data.shopEnabled || data.maintenance) return;
      const cost = price(pet.cost);
      if (data.balance < cost) return showMessage("Недостаточно денег!");
      data.balance -= cost;
      data.pets.push(pet.id);
      saveGame();
      render();
      showMessage("Питомец куплен!");
    });

    row.append(info, button);
    container.append(row);
  }
}

function multiplierCost(m) {
  return price(({ 2: 500, 5: 5000, 10: 25000 })[m] || 999999999);
}

function rebirthCost() {
  return Math.floor(100000 * Math.pow(5, Math.min(data.rebirths, 10)));
}

function claimedToday() {
  return data.dailyDate === new Date().toLocaleDateString("en-CA");
}

$("clickButton").addEventListener("click", () => {
  if (data.maintenance) return showMessage("Игра на обслуживании.");
  if (!safeAdd("clicks", 1)) return;
  if (!earn(clickIncome())) {
    data.clicks--;
    return;
  }
  saveGame();
  render();
});

$("buyUpgrade").addEventListener("click", () => {
  const cost = price(data.price);
  if (data.maintenance || !data.shopEnabled) return showMessage("Магазин выключен.");
  if (data.balance < cost) return showMessage("Недостаточно денег!");
  data.balance -= cost;
  data.power++;
  data.upgradeLevel++;
  data.price = Math.ceil(data.price * 1.6);
  saveGame();
  render();
  showMessage("Улучшение куплено!");
});

$("buyAuto").addEventListener("click", () => {
  const cost = price(data.autoPrice);
  if (data.maintenance || !data.shopEnabled) return showMessage("Магазин выключен.");
  if (data.balance < cost) return showMessage("Недостаточно денег!");
  data.balance -= cost;
  data.autoLevel++;
  data.autoPrice = Math.ceil(data.autoPrice * 1.8);
  saveGame();
  render();
  showMessage("Авто-доход улучшен!");
});

document.querySelectorAll("[data-mult]").forEach(button => {
  button.addEventListener("click", () => {
    const m = Number(button.dataset.mult);
    if (data.maintenance || !data.shopEnabled) return showMessage("Магазин выключен.");
    if (data.multiplier >= m) return showMessage("Этот множитель уже куплен!");
    const cost = multiplierCost(m);
    if (data.balance < cost) return showMessage("Недостаточно денег!");
    data.balance -= cost;
    data.multiplier = m;
    saveGame();
    render();
    showMessage("Множитель активирован!");
  });
});

$("dailyButton").addEventListener("click", () => {
  if (data.maintenance) return showMessage("Игра на обслуживании.");
  if (claimedToday()) return showMessage("Бонус уже получен сегодня!");

  const today = new Date().toLocaleDateString("en-CA");
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("en-CA");

  data.dailyStreak = data.dailyDate === yesterday ? data.dailyStreak + 1 : 1;
  data.dailyDate = today;
  const reward = Math.min(1000000, 500 * data.dailyStreak);
  if (!earn(reward)) return;
  saveGame();
  render();
  showMessage("Ежедневная награда: " + reward + " $!");
});

$("avatarBtn").addEventListener("click", () => {
  const avatars = ["😎", "🤑", "👑", "🐉", "🐺", "🚀", "💎"];
  const i = avatars.indexOf(data.avatar);
  data.avatar = avatars[(i + 1) % avatars.length];
  saveGame();
  render();
});

$("playerName").addEventListener("change", () => {
  data.playerName = $("playerName").value.trim().slice(0, 20) || "DR4KZ";
  saveGame();
  render();
});

$("theme").addEventListener("change", () => {
  data.theme = $("theme").value;
  saveGame();
  render();
});

$("saveButton").addEventListener("click", () => {
  saveGame();
  showMessage("Прогресс сохранён!");
});

$("resetButton").addEventListener("click", () => {
  if (!confirm("Точно сбросить весь прогресс? Это действие нельзя отменить.")) return;
  data = { ...DEFAULTS };
  saveGame();
  render();
  showMessage("Прогресс сброшен.");
});

$("rebirthButton").addEventListener("click", () => {
  if (data.maintenance) return showMessage("Игра на обслуживании.");
  const cost = rebirthCost();
  if (data.balance < cost) return showMessage("Нужно больше денег для перерождения!");

  if (!confirm("Перерождение сбросит баланс, клики, уровни и улучшения. Продолжить?")) return;

  data.rebirths++;
  data.permanentBonus = Math.min(1000, data.permanentBonus + 0.5);
  data.balance = 0;
  data.clicks = 0;
  data.totalEarned = 0;
  data.power = 1;
  data.upgradeLevel = 0;
  data.price = 50;
  data.autoLevel = 0;
  data.autoPrice = 250;
  data.multiplier = 1;
  data.xp = 0;
  data.level = 1;

  saveGame();
  render();
  showMessage("Перерождение успешно! Постоянный бонус увеличен.");
});

$("openAdmin").addEventListener("click", () => {
  const code = prompt("Введи код админ-панели:");
  if (code !== ADMIN_CODE) return showMessage("Неверный код!");
  $("adminPanel").hidden = false;
  showMessage("Админ-панель открыта.");
});

$("closeAdmin").addEventListener("click", () => {
  $("adminPanel").hidden = true;
});

$("giveMoney").addEventListener("click", () => {
  if ($("adminPanel").hidden) return;
  const amount = Number($("adminMoney").value);
  if (!Number.isSafeInteger(amount) || amount < 0) return showMessage("Введи корректную сумму.");
  if (!earn(amount)) return;
  saveGame();
  render();
  showMessage("Деньги выданы.");
});

$("giveXP").addEventListener("click", () => {
  if ($("adminPanel").hidden) return;
  const amount = Number($("adminXP").value);
  if (!Number.isSafeInteger(amount) || amount < 0) return showMessage("Введи корректный XP.");
  addXP(amount);
  saveGame();
  render();
  showMessage("Опыт выдан.");
});

$("applyAdmin").addEventListener("click", () => {
  if ($("adminPanel").hidden) return;

  const power = Number($("adminPower").value);
  const mult = Number($("adminMultiplier").value);
  const auto = Number($("adminAuto").value);
  const bonus = Number($("adminBonus").value);
  const prices = Number($("adminPrices").value);

  if (!Number.isSafeInteger(power) || power < 1 ||
      ![1, 2, 5, 10].includes(mult) ||
      !Number.isSafeInteger(auto) || auto < 0 ||
      !Number.isSafeInteger(bonus) || bonus < 0 ||
      !Number.isFinite(prices) || prices < 10 || prices > 1000) {
    return showMessage("Проверь значения настроек.");
  }

  data.power = power;
  data.multiplier = mult;
  data.adminAutoOverride = auto;
  data.adminBonus = bonus;
  data.pricePercent = prices;
  data.shopEnabled = $("adminShop").value === "on";
  data.maintenance = $("adminMaintenance").value === "on";

  saveGame();
  render();
  showMessage("Настройки применены и сохранены.");
});

render();

setInterval(() => {
  const now = Date.now();
  const elapsed = Math.min(10, (now - lastAutoTime) / 1000);
  lastAutoTime = now;

  if (data.maintenance || elapsed <= 0) return;

  const amount = Math.floor(autoIncome() * elapsed);
  if (amount > 0 && earn(amount)) {
    saveGame();
    render();
  }
}, 1000);
