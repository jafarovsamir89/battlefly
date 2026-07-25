# Master prompt for the coding agent

> **Архивный prompt Milestone 0.** Не использовать для продолжения продуктовой разработки после reset 25 июля 2026 года. Новый источник истины: [`BATTLEFLY_MASTER_PLAN.md`](BATTLEFLY_MASTER_PLAN.md).

Ты работаешь в репозитории `jafarovsamir89/battlefly`.

Ты выступаешь одновременно как:

- principal game engineer;
- senior TypeScript architect;
- RTS systems programmer;
- multiplayer simulation engineer;
- cross-platform UI/input engineer;
- pragmatic technical producer.

Твоя задача — начать реализацию **Battlefly / Vector Fleet: Network War**.

Перед любыми изменениями обязательно прочитай:

1. `README.md`;
2. `docs/GAME_VISION.md`;
3. существующий код, конфигурации и инструкции репозитория.

`docs/GAME_VISION.md` является источником истины. Не меняй центральную концепцию без отдельного обоснованного предложения.

---

## 1. Главная цель

Создай технический фундамент мультиплатформенной эскадренной RTS, в которой:

- игрок управляет эскадрами, а не каждым кораблём;
- карта состоит из стратегических секторов и узлов;
- энергетическая сеть является экономикой, снабжением, территорией и уязвимостью;
- чистая детерминированная симуляция отделена от Phaser и интерфейса;
- мышь, touch и gamepad преобразуются в единый набор игровых намерений;
- архитектура с первого дня совместима с будущим авторитетным сервером и replay;
- Web, desktop, Android и webOS используют одно игровое ядро.

Не пытайся сразу реализовать всю игру. Первая задача — создать надёжный **Milestone 0: Foundation**, который можно запустить, протестировать и расширить.

---

## 2. Зафиксированный технологический стек

Используй:

- TypeScript в strict mode;
- pnpm workspaces;
- Vite;
- Phaser 3 для клиентского рендера;
- Vitest для unit tests;
- ESLint;
- Prettier;
- Node.js для будущего сервера;
- WebSocket-совместимую структуру сообщений;
- чистые сериализуемые данные;
- фиксированный timestep симуляции.

Не используй React без доказанной необходимости.

Не используй Phaser physics как источник истины для игровой симуляции.

Не привязывай игровые правила к DOM, Canvas, Phaser Scene или конкретному устройству ввода.

Не загружай критические библиотеки через CDN.

---

## 3. Целевая структура монорепозитория

Создай или адаптируй следующую структуру:

```text
apps/
  web-client/
  game-server/

packages/
  simulation/
  game-rules/
  networking/
  shared-types/
  input/
  ui-core/

configs/
  eslint/
  typescript/

docs/
```

На первом этапе не создавай полноценные Android, desktop и webOS shell-приложения. Но архитектура `web-client` и platform adapters должна позволять добавить их позднее без переноса игровой логики.

При необходимости добавь короткий документ `docs/PLATFORM_ARCHITECTURE.md`, описывающий будущие оболочки:

- Web — прямая Vite-сборка;
- Android — Capacitor shell;
- Desktop — Tauri shell;
- webOS — webOS web app shell;
- Game server — Node.js authoritative process.

---

## 4. Архитектурные границы

### `packages/shared-types`

Содержит только общие сериализуемые типы:

- идентификаторы;
- vectors;
- enums;
- команды;
- snapshots;
- события;
- platform-neutral DTO.

Запрещены импорты Phaser, DOM и Node-only API.

### `packages/game-rules`

Содержит:

- баланс;
- определения зданий;
- определения эскадр;
- стоимость строительства;
- скорость генерации ресурсов;
- пропускную способность трасс;
- ограничения команд;
- карту и константы Milestone 0.

Все игровые числа должны находиться в централизованных конфигурациях, а не быть разбросаны по коду.

### `packages/simulation`

Чистое детерминированное ядро:

- `WorldState`;
- fixed timestep;
- command validation;
- command application;
- sectors;
- nodes;
- energy links;
- matter and energy economy;
- ownership;
- serialization;
- deterministic IDs;
- event output;
- snapshot generation.

Симуляция не должна знать о Phaser, UI, FPS, CSS или реальном времени браузера.

Одинаковое начальное состояние и одинаковая последовательность команд должны давать одинаковый snapshot.

### `packages/networking`

Содержит:

- protocol version;
- command envelope;
- snapshot envelope;
- acknowledgement;
- player/session identifiers;
- serialization helpers;
- placeholder transport interfaces.

Пока не нужно реализовывать полноценный онлайн-матч. Нужна правильная форма протокола.

### `packages/input`

Определяет платформенно-независимые намерения:

- select sector;
- select node;
- pan camera;
- zoom camera;
- begin link;
- preview link;
- confirm link;
- cancel action;
- focus next object;
- confirm;
- back.

Добавь адаптеры или интерфейсы для:

- mouse/keyboard;
- touch;
- gamepad/TV remote.

Адаптеры не должны напрямую изменять состояние симуляции. Они создают intents или commands.

### `packages/ui-core`

Содержит platform-neutral view models:

- selected object;
- resource summary;
- link preview;
- command availability;
- focus navigation state;
- notifications.

### `apps/web-client`

Содержит:

- Phaser bootstrap;
- BootScene;
- MainMenuScene;
- StrategyMapScene;
- renderer systems;
- camera controller;
- HUD binding;
- input adapters;
- error screen;
- performance profile selection.

### `apps/game-server`

На Milestone 0 достаточно:

- запуска Node-процесса;
- создания симуляции;
- fixed-timestep loop;
- локальной тестовой комнаты;
- логирования checksum/snapshot;
- интерфейса для будущего WebSocket transport.

Не нужно делать регистрацию, matchmaking или базу данных.

---

## 5. Milestone 0: Foundation

Реализуй именно этот этап.

### 5.1. Workspace

- настроить pnpm workspace;
- настроить TypeScript project references или понятную workspace-компиляцию;
- добавить общие scripts;
- добавить lint, typecheck, test и build;
- добавить `.gitignore`;
- добавить `.editorconfig`;
- добавить понятный `CONTRIBUTING.md` с командами запуска.

Обязательные команды из корня:

```bash
pnpm install
pnpm dev
pnpm build
pnpm typecheck
pnpm test
pnpm lint
```

### 5.2. Детерминированное состояние

Создай минимальный `WorldState`:

- tick;
- match id;
- players;
- sectors;
- nodes;
- links;
- resources;
- selected test map seed;
- event sequence number.

Используй явные ID, а не ссылки на объекты.

Не используй `Math.random()` внутри симуляции. Если случайность понадобится, создай seeded RNG и покрой его тестами.

### 5.3. Тестовая карта

Создай одну симметричную карту размером 16:9 с 10 секторами:

- два домашних сектора;
- два командных ядра;
- четыре ресурсных сектора;
- два энергетических сектора;
- два нейтральных центральных сектора;
- несколько допустимых соединений между секторами.

Координаты карты хранятся в данных и не зависят от разрешения Canvas.

### 5.4. Узлы первой версии

Реализуй типы:

- command core;
- relay;
- mine;
- reactor;
- shipyard placeholder.

На Milestone 0 здания могут быть предустановлены на карте. Полное строительство будет следующим этапом.

### 5.5. Энергетические трассы

Реализуй первую рабочую модель:

- создание link между допустимыми своими узлами;
- валидация владельца;
- максимальная длина;
- стоимость материи;
- базовая capacity;
- integrity;
- state: active, overloaded, damaged, offline;
- удаление или отключение;
- расчёт connected components или достижимости от command core;
- определение powered/unpowered nodes.

Первая версия распределения энергии может быть простой и детерминированной:

1. command core и reactors создают supply;
2. здания создают demand;
3. энергия проходит только по активным links;
4. при недостатке энергии применяется явный стабильный порядок приоритетов;
5. результат сохраняется в состоянии узлов.

### 5.6. Экономический tick

Реализуй:

- mine производит matter только когда powered;
- reactor производит energy supply;
- shipyard placeholder потребляет energy;
- disconnected sector показывает потерю питания;
- command core имеет минимальную внутреннюю генерацию;
- значения берутся из `game-rules`.

### 5.7. Команды симуляции

Минимальные команды:

- `CreateEnergyLinkCommand`;
- `RemoveEnergyLinkCommand`;
- `SetNodePriorityCommand`;
- внутренний test-only helper для пошагового прогона симуляции, если нужен.

Каждая команда должна иметь:

- command id;
- player id;
- intended tick;
- payload;
- protocol version.

Результат обработки:

- accepted/rejected;
- reason code;
- generated events.

### 5.8. Unit tests

Обязательные тесты:

- одинаковые commands дают одинаковый snapshot;
- нельзя соединить чужие узлы;
- нельзя создать link вне правил карты;
- стоимость link списывается один раз;
- mine без энергии не производит matter;
- mine после подключения начинает производство;
- разрыв ключевого link отключает удалённый узел;
- command core сохраняет аварийную генерацию;
- при дефиците энергии приоритеты применяются детерминированно;
- serialize → deserialize сохраняет состояние;
- checksum одинаков для одинакового состояния.

### 5.9. Web-клиент

Создай запускаемую стратегическую карту:

- горизонтальный Canvas;
- космический фон;
- десять видимых секторов;
- узлы;
- энергетические линии;
- цвет владельца;
- powered/unpowered state;
- matter и energy в HUD;
- текущий tick;
- выбранный объект;
- статус приложения.

Графика может быть программной и минималистичной, но должна быть читаемой и аккуратной.

### 5.10. Создание трассы через интерфейс

Mouse flow:

1. выбрать свой узел;
2. протянуть к допустимому узлу;
3. увидеть preview;
4. увидеть valid/invalid state и стоимость;
5. отпустить для подтверждения;
6. command проходит через simulation API;
7. клиент обновляется из нового snapshot.

Touch foundation:

- tap node;
- drag to target;
- release;
- крупные hit areas;
- запрет browser scrolling/zoom внутри игровой поверхности, но не ломать доступность остальной страницы.

Gamepad foundation:

- переключение фокуса между узлами;
- confirm source;
- выбрать target;
- confirm/cancel;
- визуальный focus ring.

Не требуется идеальный TV UX, но архитектура не должна быть привязана только к мыши.

### 5.11. Камера

- pan;
- zoom;
- ограничения границ;
- fit map action;
- корректная работа при изменении окна;
- никакой вертикальной прокрутки страницы для игры;
- safe areas для мобильных экранов.

### 5.12. Ошибки запуска

Никогда не оставляй пользователя с чёрным экраном.

Добавь:

- boot status;
- global error boundary для клиента;
- понятное сообщение при ошибке Phaser;
- отображение stack trace в development;
- retry/reload action;
- проверку обязательных конфигураций.

---

## 6. Что не делать в Milestone 0

Не реализуй сейчас:

- полноценные эскадры;
- сражения;
- оружие;
- fog of war;
- AI;
- production queue;
- matchmaking;
- авторизацию;
- persistence database;
- Android shell;
- Tauri shell;
- webOS package;
- магазин;
- кампанию;
- несколько фракций;
- сложные визуальные эффекты;
- свободное размещение зданий.

Можно создать интерфейсы или ADR для будущих систем, но нельзя заменять рабочий Milestone 0 огромным количеством пустых классов.
