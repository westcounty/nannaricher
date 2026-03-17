"""
Playwright E2E Test: Complete game simulation for 菜根人生 (Nannaricher)
Simulates 3 players through a complete game until victory.
Takes screenshots at key milestones to verify UI quality.

Updated for:
- 3-player game support (configurable via NUM_PLAYERS)
- New training plan system (no setup_plans, direct playing)
- Parallel plan selection UI (.plan-selection-overlay)
- EventModal uses .option-card (not .option-button)
- Settlement screen with ready-up and restart buttons
- Vote panel interactions
- Chain action panel interactions
- Card draw modal auto-dismiss
- Stuck detection with screenshots
"""

import time
import os
from playwright.sync_api import sync_playwright, Page

BASE_URL = os.environ.get("BASE_URL", "https://richer.nju.top")
SCREENSHOT_DIR = "balance-test/screenshots"
MAX_GAME_SECONDS = 2700  # 45 min max (server action timeouts can add up with more players)
NUM_PLAYERS = int(os.environ.get("NUM_PLAYERS", "3"))  # 3-player game by default
NUM_GAMES = int(os.environ.get("NUM_GAMES", "1"))  # number of games to play

os.makedirs(SCREENSHOT_DIR, exist_ok=True)

shot_counter = [0]

def shot(page: Page, name: str):
    """Take a numbered screenshot."""
    shot_counter[0] += 1
    path = f"{SCREENSHOT_DIR}/{shot_counter[0]:03d}-{name}.png"
    page.screenshot(path=path, full_page=True)
    print(f"  [Screenshot] {path}")


def dismiss_overlays(page: Page) -> bool:
    """Dismiss any tutorial or blocking overlay. Returns True if something was dismissed."""
    dismissed = False

    # Modal tutorial (5-step) — "跳过教程" (skip tutorial) or "跳过" buttons
    for skip_text in ["跳过教程", "跳过"]:
        try:
            skip = page.locator(f"text={skip_text}")
            if skip.count() > 0 and skip.first.is_visible():
                skip.first.click(force=True)
                page.wait_for_timeout(400)
                dismissed = True
                print(f"    [Overlay] Dismissed modal tutorial ({skip_text})")
                break
        except:
            pass

    # Tutorial overlay - "跳过全部" (skip all tooltip tutorial)
    try:
        skip = page.locator("text=跳过全部")
        if skip.count() > 0 and skip.first.is_visible():
            skip.first.click(force=True)
            page.wait_for_timeout(400)
            dismissed = True
            print("    [Overlay] Dismissed tutorial (skip all)")
    except:
        pass

    # Tutorial overlay - "知道了" (got it)
    try:
        got_it = page.locator("text=知道了")
        if got_it.count() > 0 and got_it.first.is_visible():
            got_it.first.click(force=True)
            page.wait_for_timeout(400)
            dismissed = True
            print("    [Overlay] Dismissed tutorial step (got it)")
    except:
        pass

    # Vote result modal — dismiss by clicking
    try:
        vote_result = page.locator(".vote-result-overlay")
        if vote_result.count() > 0 and vote_result.first.is_visible():
            close_btn = vote_result.locator("button")
            if close_btn.count() > 0:
                close_btn.last.click(force=True)
                page.wait_for_timeout(400)
                dismissed = True
                print("    [Overlay] Dismissed vote result modal")
    except:
        pass

    # Read-only event modal — wait for auto-dismiss or click overlay
    try:
        ro = page.locator(".event-modal-overlay.read-only")
        if ro.count() > 0 and ro.first.is_visible():
            page.wait_for_timeout(1500)
            dismissed = True
    except:
        pass

    # Card draw modal — click to dismiss if revealed
    try:
        card_hint = page.locator(".card-draw-hint")
        if card_hint.count() > 0 and card_hint.first.is_visible():
            card_hint.first.click(force=True)
            page.wait_for_timeout(400)
            dismissed = True
            print("    [Overlay] Dismissed card draw modal")
    except:
        pass

    # Card draw overlay still showing (flipping phase) — wait
    try:
        card_overlay = page.locator(".card-draw-overlay")
        if card_overlay.count() > 0 and card_overlay.first.is_visible():
            page.wait_for_timeout(1500)
            dismissed = True
    except:
        pass

    # Epic event modal — read-only (other player's event) — wait for auto-dismiss
    try:
        epic = page.locator(".epic-overlay")
        if epic.count() > 0 and epic.first.is_visible():
            # Check if it's read-only (has readonly badge)
            readonly_badge = epic.locator(".epic-card__readonly")
            if readonly_badge.count() > 0 and readonly_badge.first.is_visible():
                page.wait_for_timeout(2000)
                dismissed = True
                print("    [Overlay] Waiting for epic event read-only auto-dismiss")
    except:
        pass

    return dismissed


def dismiss_all_overlays(page: Page):
    """Keep dismissing overlays until none remain."""
    for _ in range(10):
        if not dismiss_overlays(page):
            break
        page.wait_for_timeout(200)


def try_click_any(page: Page, selectors: list[str], force: bool = False) -> str | None:
    """Try clicking the first visible element matching any selector. Returns matched selector or None."""
    for sel in selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0 and loc.first.is_visible():
                loc.first.click(force=force, timeout=3000)
                return sel
        except:
            pass
    return None


def get_visible_text(page: Page, selector: str) -> str:
    """Get text content of first visible element or empty string."""
    try:
        loc = page.locator(selector)
        if loc.count() > 0 and loc.first.is_visible():
            return loc.first.inner_text(timeout=2000)
    except:
        pass
    return ""


def bypass_auth(page: Page, player_name: str):
    """Inject mock auth tokens into localStorage to bypass login screen."""
    page.goto(BASE_URL, timeout=120000, wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle", timeout=120000)
    import json, base64, time as _time
    user_id = f"test-{int(_time.time() * 1000)}"
    mock_user = json.dumps({"userId": user_id, "username": player_name, "nickname": player_name})
    header = base64.b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    now = int(_time.time())
    payload_obj = {"sub": user_id, "iat": now, "exp": now + 86400}
    payload = base64.b64encode(json.dumps(payload_obj).encode()).decode().rstrip("=")
    mock_token = f"{header}.{payload}.mock"
    page.evaluate(f"""() => {{
        localStorage.setItem('nannaricher_access_token', '{mock_token}');
        localStorage.setItem('nannaricher_refresh_token', 'mock-refresh');
        localStorage.setItem('nannaricher_user', {json.dumps(mock_user)});
        localStorage.setItem('tutorial_completed', 'true');
        localStorage.setItem('nannaricher_tutorial_completed', JSON.stringify(['first_dice','plan_confirm','first_card_draw','first_branch']));
    }}""")
    page.reload()
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(500)


def create_room(page: Page, player_name: str) -> str:
    """Player creates a room. Returns room code."""
    bypass_auth(page, player_name)
    shot(page, "lobby")

    page.click(".lobby-button.create")
    page.wait_for_timeout(500)

    name_input = page.locator("input#playerName")
    if name_input.count() > 0 and name_input.first.is_visible():
        name_input.fill(player_name)
    page.wait_for_timeout(200)

    # Select 1 dice
    dice = page.locator(".dice-option")
    if dice.count() > 0:
        dice.first.click()

    page.click(".submit-button")
    page.wait_for_timeout(2000)
    shot(page, "waiting-room-host")

    code = page.locator(".room-code").inner_text().strip()
    print(f"  Room created: {code}")
    return code


def join_room(page: Page, room_code: str, player_name: str):
    """Player joins an existing room."""
    bypass_auth(page, player_name)

    page.click(".lobby-button.join")
    page.wait_for_timeout(500)

    page.fill("input#roomCode", room_code)
    name_input = page.locator("input#playerName")
    if name_input.count() > 0 and name_input.first.is_visible():
        name_input.fill(player_name)
    page.wait_for_timeout(200)

    dice = page.locator(".dice-option")
    if dice.count() > 0:
        dice.first.click()

    page.click(".submit-button")
    page.wait_for_timeout(2000)
    shot(page, "waiting-room-joined")
    print(f"  {player_name} joined room {room_code}")


def start_game(page: Page):
    """Host starts the game."""
    btn = page.locator("button.start-button:has-text('开始游戏')")
    btn.wait_for(state="visible", timeout=15000)
    shot(page, "before-start")
    btn.click()
    page.wait_for_timeout(2000)
    print("  Game started!")


def handle_plan_selection(page: Page, player_name: str) -> bool:
    """Handle the parallel plan selection panel. Returns True if handled."""
    panel = page.locator(".plan-selection-overlay")
    if panel.count() == 0 or not panel.first.is_visible():
        return False

    # Check if already submitted
    submitted = page.locator(".plan-selection__submitted")
    if submitted.count() > 0 and submitted.first.is_visible():
        return True  # already submitted, wait for others

    # Click first unselected plan item
    items = page.locator(".plan-selection__item:not(.selected)")
    if items.count() > 0:
        items.first.click(force=True)
        page.wait_for_timeout(300)

    # Try to set a major if needed
    set_major = page.locator(".plan-selection__set-major")
    if set_major.count() > 0 and set_major.first.is_visible():
        set_major.first.click(force=True)
        page.wait_for_timeout(200)

    # Try confirm button
    confirm = page.locator(".plan-selection__btn--primary:not([disabled])")
    if confirm.count() > 0 and confirm.first.is_visible():
        confirm.first.click(force=True)
        page.wait_for_timeout(600)
        return True

    # If can't confirm, try "不调整" button
    keep = page.locator(".plan-selection__btn--secondary")
    if keep.count() > 0 and keep.first.is_visible():
        keep.first.click(force=True)
        page.wait_for_timeout(600)
        return True

    return True  # panel visible, processing


def handle_action(page: Page, player_name: str) -> str:
    """Try to handle one pending action. Returns action type or ''.

    IMPORTANT: Game actions (dice, choices) must NOT use force=True so that
    the test accurately reflects whether a real user could interact.
    Only overlay/modal dismissal clicks may use force=True since those
    target the topmost layer which may have animation timing issues.
    """

    # Always try dismissing overlays first
    dismiss_overlays(page)

    # 0. Parallel plan selection panel (highest priority — it IS the topmost overlay)
    if handle_plan_selection(page, player_name):
        return "plan_selection"

    # 0.5. Epic event modal (corner events: 起点/校医院/鼎/候车厅)
    #    Uses .epic-option buttons instead of .option-card
    epic = page.locator(".epic-overlay")
    if epic.count() > 0 and epic.first.is_visible():
        # Check for interactive options (not read-only)
        epic_opts = epic.locator(".epic-option:not(.epic-option--selected)")
        if epic_opts.count() > 0:
            try:
                epic_opts.first.click(timeout=3000, no_wait_after=True)
                page.wait_for_timeout(400)
                return "epic_option"
            except:
                pass
        # Epic event without options — click confirm
        epic_confirm = epic.locator(".epic-card__confirm")
        if epic_confirm.count() > 0 and epic_confirm.first.is_visible():
            try:
                epic_confirm.first.click(timeout=3000, no_wait_after=True)
                page.wait_for_timeout(400)
                return "epic_confirm"
            except:
                pass

    # 1. Event modal with options (using .option-card selector)
    #    Modal IS the topmost element, so clicking its children is valid.
    #    Use force=True because animation overlays can temporarily intercept clicks.
    event = page.locator(".event-modal.has-options")
    if event.count() > 0 and event.first.is_visible():
        # Click first option card
        opts = event.locator(".option-card:not(.selected)")
        if opts.count() > 0:
            try:
                opts.first.click(timeout=3000, force=True, no_wait_after=True)
                page.wait_for_timeout(400)
                return "event_option_card"
            except:
                pass
        # If no unselected cards, try confirm
        cfm = event.locator(".confirm-button")
        if cfm.count() > 0 and cfm.first.is_visible():
            try:
                cfm.first.click(timeout=3000, force=True, no_wait_after=True)
                page.wait_for_timeout(400)
                return "event_confirm"
            except:
                pass

    # 2. Event modal with tabbed options
    tabbed = page.locator(".options-tabbed")
    if tabbed.count() > 0 and tabbed.first.is_visible():
        tab_opts = tabbed.locator(".option-card:not(.selected):not([disabled])")
        if tab_opts.count() > 0:
            try:
                tab_opts.first.click(timeout=3000, force=True, no_wait_after=True)
                page.wait_for_timeout(400)
                return "event_tabbed_option"
            except:
                pass
        tab_btns = tabbed.locator(".option-button:not(.disabled):not([disabled])")
        if tab_btns.count() > 0:
            try:
                tab_btns.first.click(timeout=3000, force=True, no_wait_after=True)
                page.wait_for_timeout(400)
                return "event_tabbed_option"
            except:
                pass

    # 3. Event modal without options — click confirm or overlay to dismiss
    event_ro = page.locator(".event-modal:not(.has-options):not(.read-only)")
    if event_ro.count() > 0 and event_ro.first.is_visible():
        cfm = event_ro.locator(".confirm-button")
        if cfm.count() > 0 and cfm.first.is_visible():
            try:
                cfm.first.click(timeout=3000, force=True, no_wait_after=True)
                page.wait_for_timeout(400)
                return "event_confirm"
            except:
                pass
        # Click overlay edge to dismiss (force ok — clicking the overlay itself)
        overlay = page.locator(".event-modal-overlay")
        if overlay.count() > 0:
            overlay.first.click(force=True, position={"x": 10, "y": 10})
            page.wait_for_timeout(400)
            return "event_overlay_dismiss"

    # 4. Vote panel (multi-vote) — panel IS topmost
    vote = page.locator(".vote-panel__overlay")
    if vote.count() > 0 and vote.first.is_visible():
        opts = vote.locator(".vote-panel__option-btn:not(.vote-panel__option-btn--selected):not(.vote-panel__option-btn--dimmed):not([disabled])")
        if opts.count() > 0:
            opts.first.click(timeout=3000, no_wait_after=True)
            page.wait_for_timeout(400)
            return "vote"

    # 4.5. Chain action panel — panel IS topmost
    chain = page.locator(".chain-action__overlay")
    if chain.count() > 0 and chain.first.is_visible():
        chain_btns = chain.locator(".chain-action__action-btn")
        if chain_btns.count() > 0:
            chain_btns.first.click(timeout=3000, no_wait_after=True)
            page.wait_for_timeout(400)
            return "chain_action"

    # 4.6. Choice dialog — dialog IS topmost
    #    Clicks use no_wait_after=True because socket updates may remove the
    #    element before Playwright's post-click navigation check completes.
    choice = page.locator(".choice-dialog-overlay")
    if choice.count() > 0 and choice.first.is_visible():
        multi = choice.locator(".choice-dialog.multi-select")
        if multi.count() > 0 and multi.first.is_visible():
            unchecked = multi.locator(".option-button:not(.disabled):not(.selected)")
            if unchecked.count() > 0:
                unchecked.first.click(timeout=3000, no_wait_after=True)
                page.wait_for_timeout(200)
            confirm_btn = multi.locator(".confirm-button:not([disabled])")
            if confirm_btn.count() > 0 and confirm_btn.first.is_visible():
                confirm_btn.first.click(timeout=3000, no_wait_after=True)
                page.wait_for_timeout(400)
                return "multi_select_confirm"
        else:
            opts = choice.locator(".option-button:not(.disabled):not([disabled])")
            if opts.count() > 0:
                try:
                    opts.first.click(timeout=3000, force=True, no_wait_after=True)
                    page.wait_for_timeout(400)
                    return "choice_dialog"
                except:
                    pass

    # 5. Dice button
    for dice_sel in [".action-bar__dice-btn", ".mobile-bottom-nav__dice-btn"]:
        try:
            dice_btn = page.locator(dice_sel)
            if dice_btn.count() > 0:
                vis = dice_btn.first.is_visible()
                if not vis:
                    continue
                is_disabled = dice_btn.first.evaluate("el => el.disabled")
                txt = dice_btn.first.evaluate("el => el.innerText || ''")
                if not is_disabled and ("掷骰子" in txt or "投骰" in txt) and "等待" not in txt and "中..." not in txt:
                    dice_btn.first.click(timeout=5000, force=True)
                    page.wait_for_timeout(2000)
                    return "roll_dice"
        except:
            pass

    # 6. Fallback: any .option-card visible
    any_card = page.locator(".option-card:visible")
    if any_card.count() > 0:
        try:
            any_card.first.click(timeout=3000, force=True)
            page.wait_for_timeout(400)
            return "generic_option_card"
        except:
            pass

    # 7. Legacy fallback: any .option-button
    any_opt = page.locator(".option-button:visible")
    if any_opt.count() > 0:
        try:
            any_opt.first.click(timeout=3000, force=True)
            page.wait_for_timeout(400)
            return "generic_option"
        except:
            pass

    return ""


def is_game_over(page: Page) -> bool:
    """Check if game is finished."""
    try:
        settlement = page.locator(".settlement-overlay")
        if settlement.count() > 0 and settlement.first.is_visible():
            return True
    except:
        pass
    return False


def handle_settlement(page: Page, player_name: str):
    """Handle settlement screen — read results, optionally ready up."""
    try:
        winner_name = page.locator(".settlement-rankings__row--winner .settlement-rankings__name").inner_text()
        print(f"  Winner: {winner_name}")
    except:
        pass

    try:
        # Check for ready button
        ready_btn = page.locator(".settlement-btn--ready")
        if ready_btn.count() > 0 and ready_btn.first.is_visible():
            print(f"  [{player_name}] Ready button available")
    except:
        pass


def run_one_game(browser, num_players: int, game_num: int) -> dict:
    """Run a single game with given player count. Returns result dict."""
    print(f"\n{'='*60}")
    print(f"  Game {game_num}: {num_players} players")
    print(f"{'='*60}")

    contexts = []
    pages = []
    names = [f"G{game_num}P{i+1}" for i in range(num_players)]
    result = {"game": game_num, "players": num_players, "status": "unknown", "actions": 0, "duration": 0, "winner": ""}

    for i in range(num_players):
        ctx = browser.new_context(viewport={"width": 1280, "height": 900})
        pg = ctx.new_page()
        pg.set_default_timeout(60000)
        contexts.append(ctx)
        pages.append(pg)

    try:
        # Create & join room
        print(f"  [1] Creating room (host: {names[0]})...")
        code = create_room(pages[0], names[0])

        print(f"  [2] {num_players - 1} players joining...")
        for i in range(1, num_players):
            join_room(pages[i], code, names[i])
            pages[0].wait_for_timeout(1000)

        # Start game
        print("  [3] Starting game...")
        start_game(pages[0])

        # Wait for game to fully initialize + dismiss tutorials
        pages[0].wait_for_timeout(4000)
        for i, pg in enumerate(pages):
            dismiss_all_overlays(pg)
        pages[0].wait_for_timeout(1000)

        # Game loop
        print("  [4] Playing game...")
        start_time = time.time()
        actions = 0
        last_action_time = time.time()
        STUCK_THRESHOLD = 90

        while time.time() - start_time < MAX_GAME_SECONDS:
            game_over = False
            for i, pg in enumerate(pages):
                if is_game_over(pg):
                    duration = time.time() - start_time
                    print(f"\n  GAME OVER! Actions: {actions}, Duration: {duration:.0f}s")
                    winner = ""
                    try:
                        winner = pg.locator(".settlement-rankings__row--winner .settlement-rankings__name").inner_text()
                    except:
                        pass
                    print(f"  Winner: {winner}")
                    shot(pg, f"g{game_num}-gameover")
                    result.update(status="completed", actions=actions, duration=round(duration), winner=winner)
                    game_over = True
                    break
            if game_over:
                break

            acted = False
            for i, pg in enumerate(pages):
                action = handle_action(pg, names[i])
                if action:
                    actions += 1
                    acted = True
                    last_action_time = time.time()
                    elapsed = time.time() - start_time
                    if actions % 20 == 0:
                        print(f"  [Action #{actions}] {names[i]}: {action} ({elapsed:.0f}s)")

            if not acted:
                pages[0].wait_for_timeout(500)
                idle_secs = time.time() - last_action_time
                if idle_secs > STUCK_THRESHOLD and int(idle_secs) % STUCK_THRESHOLD < 1:
                    elapsed = time.time() - start_time
                    print(f"  [STUCK?] No actions for {idle_secs:.0f}s (elapsed: {elapsed:.0f}s)")
                    for i, pg in enumerate(pages):
                        shot(pg, f"g{game_num}-stuck-p{i+1}")
                    if idle_secs > STUCK_THRESHOLD * 3:
                        print(f"  [FATAL] Game stuck after {idle_secs:.0f}s idle.")
                        result.update(status="stuck", actions=actions, duration=round(time.time() - start_time))
                        break
        else:
            duration = time.time() - start_time
            print(f"  TIMEOUT after {MAX_GAME_SECONDS}s, {actions} actions")
            result.update(status="timeout", actions=actions, duration=round(duration))

    except Exception as e:
        print(f"  ERROR: {e}")
        result.update(status=f"error: {e}", duration=round(time.time() - start_time) if 'start_time' in dir() else 0)
    finally:
        for ctx in contexts:
            try:
                ctx.close()
            except:
                pass

    return result


def main():
    # Game configs: 10 games, cycling through 2-6 players
    player_counts = [2, 3, 4, 5, 6, 2, 3, 4, 5, 6]
    num_games = int(os.environ.get("NUM_GAMES", str(len(player_counts))))
    player_counts = player_counts[:num_games]

    print("=" * 60)
    print(f"  Nannaricher E2E Test: {num_games} games")
    print(f"  Player counts: {player_counts}")
    print(f"  Target: {BASE_URL}")
    print("=" * 60)

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            for i, nplayers in enumerate(player_counts):
                result = run_one_game(browser, nplayers, i + 1)
                results.append(result)
                print(f"  => Game {i+1}: {result['status']} ({result['players']}p, {result['actions']} actions, {result['duration']}s)")
                # Brief pause between games to let server recover
                time.sleep(3)
        finally:
            browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("  E2E TEST SUMMARY")
    print("=" * 60)
    print(f"  {'Game':<6} {'Players':<9} {'Status':<12} {'Actions':<9} {'Duration':<10} {'Winner'}")
    print(f"  {'-'*6} {'-'*9} {'-'*12} {'-'*9} {'-'*10} {'-'*15}")
    completed = 0
    for r in results:
        status_mark = "✅" if r['status'] == 'completed' else "❌"
        print(f"  {r['game']:<6} {r['players']:<9} {status_mark} {r['status']:<10} {r['actions']:<9} {r['duration']:<10} {r['winner']}")
        if r['status'] == 'completed':
            completed += 1
    print(f"\n  Result: {completed}/{num_games} games completed successfully")
    print("=" * 60)

    # Save results
    import json
    with open("balance-test/report/e2e-results.json", "w") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)
    print(f"  Results saved to balance-test/report/e2e-results.json")


if __name__ == "__main__":
    main()
