"""
Playwright E2E Test: Complete game simulation for 菜根人生 (Nannaricher)
Simulates 2 players through a complete game until victory.
Takes screenshots at key milestones to verify UI quality.

Updated for:
- New training plan system (no setup_plans, direct playing)
- Parallel plan selection UI (.plan-selection-overlay)
- EventModal uses .option-card (not .option-button)
- Settlement screen with ready-up and restart buttons
- Vote panel interactions
"""

import time
import os
from playwright.sync_api import sync_playwright, Page

BASE_URL = os.environ.get("BASE_URL", "http://localhost:5173")
SCREENSHOT_DIR = "balance-test/screenshots"
MAX_GAME_SECONDS = 600  # 10 min max

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

    # Tutorial overlay - "跳过全部" (skip all)
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

    # Read-only event modal — wait for auto-dismiss or click overlay
    try:
        ro = page.locator(".event-modal-overlay.read-only")
        if ro.count() > 0 and ro.first.is_visible():
            page.wait_for_timeout(1500)
            dismissed = True
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
            return loc.first.inner_text()
    except:
        pass
    return ""


def bypass_auth(page: Page, player_name: str):
    """Inject mock auth tokens into localStorage to bypass login screen."""
    page.goto(BASE_URL)
    page.wait_for_load_state("networkidle")
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
    btn = page.locator(".start-button")
    btn.wait_for(state="visible", timeout=10000)
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
    """Try to handle one pending action. Returns action type or ''."""

    # Always try dismissing overlays first
    dismiss_overlays(page)

    # 0. Parallel plan selection panel (highest priority)
    if handle_plan_selection(page, player_name):
        return "plan_selection"

    # 1. Event modal with options (using .option-card selector)
    event = page.locator(".event-modal.has-options")
    if event.count() > 0 and event.first.is_visible():
        # Click first option card
        opts = event.locator(".option-card:not(.selected)")
        if opts.count() > 0:
            opts.first.click(force=True)
            page.wait_for_timeout(800)
            return "event_option_card"
        # If no unselected cards, try confirm
        cfm = event.locator(".confirm-button")
        if cfm.count() > 0 and cfm.first.is_visible():
            cfm.first.click(force=True)
            page.wait_for_timeout(800)
            return "event_confirm"

    # 2. Event modal with tabbed options
    tabbed = page.locator(".options-tabbed")
    if tabbed.count() > 0 and tabbed.first.is_visible():
        # Click first available tab content option
        tab_opts = tabbed.locator(".option-card:not(.selected)")
        if tab_opts.count() > 0:
            tab_opts.first.click(force=True)
            page.wait_for_timeout(800)
            return "event_tabbed_option"

    # 3. Event modal without options — click confirm or overlay
    event_ro = page.locator(".event-modal:not(.has-options):not(.read-only)")
    if event_ro.count() > 0 and event_ro.first.is_visible():
        cfm = event_ro.locator(".confirm-button")
        if cfm.count() > 0 and cfm.first.is_visible():
            cfm.first.click(force=True)
            page.wait_for_timeout(800)
            return "event_confirm"
        overlay = page.locator(".event-modal-overlay:not(.read-only)")
        if overlay.count() > 0:
            overlay.first.click(force=True, position={"x": 10, "y": 10})
            page.wait_for_timeout(800)
            return "event_overlay_dismiss"

    # 4. Vote panel (multi-vote)
    vote = page.locator(".vote-panel__overlay")
    if vote.count() > 0 and vote.first.is_visible():
        opts = vote.locator(".vote-panel__option-btn:not(.vote-panel__option-btn--selected):not(.vote-panel__option-btn--dimmed):not([disabled])")
        if opts.count() > 0:
            opts.first.click(force=True)
            page.wait_for_timeout(800)
            return "vote"

    # 5. Dice button
    dice_btn = page.locator(".action-bar__dice-btn")
    if dice_btn.count() > 0 and dice_btn.first.is_visible():
        txt = get_visible_text(page, ".action-bar__dice-btn")
        if ("掷骰子" in txt or "投骰" in txt) and "等待" not in txt and "中..." not in txt:
            dice_btn.first.click(force=True)
            page.wait_for_timeout(2000)
            return "roll_dice"

    # 6. Fallback: any .option-card visible (newer selector)
    any_card = page.locator(".option-card:visible")
    if any_card.count() > 0:
        any_card.first.click(force=True)
        page.wait_for_timeout(800)
        return "generic_option_card"

    # 7. Legacy fallback: any .option-button (older components)
    any_opt = page.locator(".option-button:visible")
    if any_opt.count() > 0:
        any_opt.first.click(force=True)
        page.wait_for_timeout(800)
        return "generic_option"

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


def main():
    print("=" * 60)
    print("  Nannaricher Playwright E2E Game Test")
    print("=" * 60)

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        ctx1 = browser.new_context(viewport={"width": 1280, "height": 900})
        ctx2 = browser.new_context(viewport={"width": 1280, "height": 900})
        page1 = ctx1.new_page()
        page2 = ctx2.new_page()
        page1.set_default_timeout(30000)
        page2.set_default_timeout(30000)

        names = ["Player1", "Player2"]

        try:
            # Create & join room
            print("\n[1] Creating room...")
            code = create_room(page1, names[0])

            print("[2] Joining room...")
            join_room(page2, code, names[1])
            page1.wait_for_timeout(1500)
            shot(page1, "both-ready")

            # Start game
            print("[3] Starting game...")
            start_game(page1)

            # Dismiss tutorials
            page1.wait_for_timeout(2000)
            dismiss_all_overlays(page1)
            dismiss_all_overlays(page2)

            shot(page1, "game-start-p1")
            shot(page2, "game-start-p2")

            # Game loop
            print("[4] Playing game...")
            start_time = time.time()
            actions = 0
            last_shot_action = -10

            while time.time() - start_time < MAX_GAME_SECONDS:
                # Check game over
                for i, pg in enumerate([page1, page2]):
                    if is_game_over(pg):
                        print(f"\n  GAME OVER detected on {names[i]}'s screen!")
                        shot(page1, "game-over-p1")
                        shot(page2, "game-over-p2")
                        print(f"  Total actions: {actions}")
                        print(f"  Duration: {time.time() - start_time:.0f}s")
                        handle_settlement(page1, names[0])
                        return

                # Try actions on BOTH players
                acted = False
                for i, pg in enumerate([page1, page2]):
                    action = handle_action(pg, names[i])
                    if action:
                        actions += 1
                        acted = True
                        if actions % 5 == 0:
                            elapsed = time.time() - start_time
                            print(f"  [Action #{actions}] {names[i]}: {action} ({elapsed:.0f}s)")
                        if actions - last_shot_action >= 15:
                            last_shot_action = actions
                            shot(pg, f"action-{actions:03d}")

                if not acted:
                    page1.wait_for_timeout(500)

            print(f"\n  TIMEOUT after {MAX_GAME_SECONDS}s, {actions} actions taken")
            shot(page1, "timeout-p1")
            shot(page2, "timeout-p2")

        except Exception as e:
            print(f"\n  ERROR: {e}")
            try:
                shot(page1, "error-p1")
                shot(page2, "error-p2")
            except:
                pass
            raise
        finally:
            browser.close()

    print("\n" + "=" * 60)
    print("  Test Complete")
    print("=" * 60)


if __name__ == "__main__":
    main()
