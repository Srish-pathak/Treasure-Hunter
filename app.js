(function () {
  const CONFIG = {
    easy:   { size: 6,  treasures: 5,  traps: 4,  moves: 20, hints: 4 },
    medium: { size: 8,  treasures: 8,  traps: 8,  moves: 28, hints: 3 },
    hard:   { size: 10, treasures: 12, traps: 14, moves: 36, hints: 2 }
  };

  const POINTS_PER_TREASURE = 100;
  const TRAP_PENALTY = 50;

  const gridEl = document.getElementById('grid');
  const movesLeftEl = document.getElementById('moves-left');
  const foundCountEl = document.getElementById('found-count');
  const scoreEl = document.getElementById('score');
  const messageBarEl = document.getElementById('message-bar');
  const newGameBtn = document.getElementById('new-game-btn');
  const hintBtn = document.getElementById('hint-btn');
  const difficultySelect = document.getElementById('difficulty-select');
  const overlay = document.getElementById('overlay');
  const overlayTitle = document.getElementById('overlay-title');
  const overlayText = document.getElementById('overlay-text');
  const overlayBtn = document.getElementById('overlay-btn');

  let state = null;

  function rand(n) {
    return Math.floor(Math.random() * n);
  }

  function buildBoard(cfg) {
    const total = cfg.size * cfg.size;
    const cells = new Array(total).fill('empty');

    const placeRandom = (type, count) => {
      let placed = 0;
      let attempts = 0;
      while (placed < count && attempts < total * 20) {
        const idx = rand(total);
        attempts++;
        if (cells[idx] === 'empty') {
          cells[idx] = type;
          placed++;
        }
      }
      return placed;
    };

    const actualTreasures = placeRandom('treasure', cfg.treasures);
    placeRandom('trap', cfg.traps);

    return { cells, size: cfg.size, treasureTotal: actualTreasures };
  }

  function manhattanDistanceToNearestTreasure(idx, board) {
    const size = board.size;
    const x1 = idx % size;
    const y1 = Math.floor(idx / size);
    let best = Infinity;
    board.cells.forEach((type, i) => {
      if (type === 'treasure') {
        const x2 = i % size;
        const y2 = Math.floor(i / size);
        const d = Math.abs(x1 - x2) + Math.abs(y1 - y2);
        if (d < best) best = d;
      }
    });
    return best;
  }

  function startGame(difficulty) {
    const cfg = CONFIG[difficulty];
    const board = buildBoard(cfg);

    state = {
      cfg,
      board,
      revealed: new Array(board.cells.length).fill(false),
      movesLeft: cfg.moves,
      hintsLeft: cfg.hints,
      treasuresFound: 0,
      treasureTotal: board.treasureTotal,
      score: 0,
      gameOver: false
    };

    renderGrid();
    updateHud();
    setMessage('Choose a tile on the map to start digging.');
    hideOverlay();
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    gridEl.style.gridTemplateColumns = `repeat(${state.board.size}, 1fr)`;

    state.board.cells.forEach((type, idx) => {
      const tile = document.createElement('button');
      tile.className = 'tile';
      tile.setAttribute('data-idx', idx);
      tile.setAttribute('aria-label', 'Dig tile ' + (idx + 1));

      const glow = document.createElement('span');
      glow.className = 'glow';
      tile.appendChild(glow);

      tile.addEventListener('click', () => handleTileClick(idx, tile));
      gridEl.appendChild(tile);
    });
  }

  function handleTileClick(idx, tileEl) {
    if (state.gameOver) return;
    if (state.revealed[idx]) return;

    revealTile(idx, tileEl);
  }

  function revealTile(idx, tileEl) {
    state.revealed[idx] = true;
    state.movesLeft--;

    const type = state.board.cells[idx];
    tileEl.classList.add('revealed', type);
    tileEl.classList.remove('near');
    tileEl.innerHTML = '';

    const icon = document.createElement('span');

    if (type === 'treasure') {
      icon.textContent = '💰';
      state.treasuresFound++;
      state.score += POINTS_PER_TREASURE;
      setMessage('A chest of doubloons! +' + POINTS_PER_TREASURE + ' gold.');
    } else if (type === 'trap') {
      icon.textContent = '☠️';
      state.score = Math.max(0, state.score - TRAP_PENALTY);
      setMessage('Cursed bones! -' + TRAP_PENALTY + ' gold.');
    } else {
      const dist = manhattanDistanceToNearestTreasure(idx, state.board);
      if (dist <= 1) {
        icon.textContent = '🔥';
        setMessage('The sand is hot — treasure lies right beside ye!');
      } else if (dist === 2) {
        icon.textContent = '♨️';
        setMessage('Warmer... keep digging nearby.');
      } else {
        icon.textContent = '·';
        setMessage('Cold sand. No gold for miles.');
      }
    }

    tileEl.appendChild(icon);
    updateHud();
    checkEndConditions();
  }

  function checkEndConditions() {
    if (state.treasuresFound >= state.treasureTotal) {
      endGame(true);
      return;
    }
    if (state.movesLeft <= 0) {
      endGame(false);
      return;
    }
  }

  function endGame(won) {
    state.gameOver = true;
    if (won) {
      overlayTitle.textContent = 'Ye found the hoard!';
      overlayText.textContent = 'All ' + state.treasureTotal + ' chests unearthed with ' + state.movesLeft + ' shovels to spare. Final haul: ' + state.score + ' gold.';
      setMessage('Victory! Every chest is yours, captain.');
    } else {
      overlayTitle.textContent = 'Shovels run dry';
      overlayText.textContent = 'Ye uncovered ' + state.treasuresFound + ' of ' + state.treasureTotal + ' chests. Final haul: ' + state.score + ' gold.';
      setMessage('No shovels left. The sea claims the rest.');
      revealAllTreasures();
    }
    showOverlay();
  }

  function revealAllTreasures() {
    document.querySelectorAll('.tile').forEach((tileEl) => {
      const idx = Number(tileEl.getAttribute('data-idx'));
      if (state.board.cells[idx] === 'treasure' && !state.revealed[idx]) {
        tileEl.classList.add('revealed', 'treasure');
        tileEl.innerHTML = '<span>💰</span>';
      }
    });
  }

  function useHint() {
    if (state.gameOver) return;
    if (state.hintsLeft <= 0) {
      setMessage('No more spyglass charges left!');
      return;
    }

    const candidates = [];
    state.board.cells.forEach((type, idx) => {
      if (!state.revealed[idx] && type === 'treasure') {
        candidates.push(idx);
      }
    });

    if (candidates.length === 0) {
      setMessage('No hidden treasure left to spy.');
      return;
    }

    state.hintsLeft--;
    const targetIdx = candidates[rand(candidates.length)];
    const size = state.board.size;
    const tx = targetIdx % size;
    const ty = Math.floor(targetIdx / size);

    document.querySelectorAll('.tile').forEach((tileEl) => {
      const idx = Number(tileEl.getAttribute('data-idx'));
      if (state.revealed[idx]) return;
      const x = idx % size;
      const y = Math.floor(idx / size);
      const d = Math.abs(x - tx) + Math.abs(y - ty);
      if (d <= 1) {
        tileEl.classList.add('near');
        setTimeout(() => tileEl.classList.remove('near'), 2500);
      }
    });

    hintBtn.textContent = 'Consult spyglass (' + state.hintsLeft + ')';
    setMessage('The spyglass reveals glowing sand near a chest.');
  }

  function setMessage(msg) {
    messageBarEl.textContent = msg;
  }

  function updateHud() {
    movesLeftEl.textContent = state.movesLeft;
    foundCountEl.textContent = state.treasuresFound + '/' + state.treasureTotal;
    scoreEl.textContent = state.score;
    hintBtn.textContent = 'Consult spyglass (' + state.hintsLeft + ')';
  }

  function showOverlay() {
    overlay.classList.add('show');
  }

  function hideOverlay() {
    overlay.classList.remove('show');
  }

  newGameBtn.addEventListener('click', () => {
    startGame(difficultySelect.value);
  });

  hintBtn.addEventListener('click', useHint);

  overlayBtn.addEventListener('click', () => {
    startGame(difficultySelect.value);
  });

  difficultySelect.addEventListener('change', () => {
    startGame(difficultySelect.value);
  });

  startGame(difficultySelect.value);
})();
