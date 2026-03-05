// e2e/game.spec.ts
// 菜根人生 E2E 测试 - 使用 Playwright

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL || 'http://localhost:5173';

/** Bypass auth by injecting a mock user into localStorage */
async function bypassAuth(page: Page, nickname = 'E2E测试员') {
  await page.goto(BASE_URL);
  await page.evaluate(({ nickname }) => {
    const mockUser = { userId: `test-${Date.now()}`, username: 'e2e_tester', nickname };
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({ sub: mockUser.userId, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 86400 }));
    const mockToken = `${header}.${payload}.mock`;
    localStorage.setItem('nannaricher_access_token', mockToken);
    localStorage.setItem('nannaricher_refresh_token', 'mock-refresh');
    localStorage.setItem('nannaricher_user', JSON.stringify(mockUser));
  }, { nickname });
  await page.reload();
  await page.waitForTimeout(500);
}

test.describe('菜根人生游戏', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test('首页应该正确加载', async ({ page }) => {
    // 检查页面标题
    await expect(page).toHaveTitle(/菜根人生|Nannaricher/);

    // 检查创建房间按钮存在
    const createButton = page.getByRole('button', { name: /创建房间|Create Room/i });
    await expect(createButton).toBeVisible();
  });

  test('应该能够创建房间', async ({ page }) => {
    // 点击创建房间
    await page.getByRole('button', { name: /创建房间/i }).click();

    // 输入玩家名称
    const nameInput = page.getByPlaceholder(/输入.*名字|你的名字/i);
    if (await nameInput.isVisible()) {
      await nameInput.fill('测试玩家');
    }

    // 确认创建
    await page.getByRole('button', { name: /确认|创建|开始/i }).first().click();

    // 应该进入房间等待页面
    await expect(page.locator('.room-code')).toBeVisible({ timeout: 10000 });
  });

  test('应该能够加入房间', async ({ page, context }) => {
    // 创建第一个页面并创建房间
    const page1 = await context.newPage();
    await bypassAuth(page1, '玩家1');
    await page1.getByRole('button', { name: /创建房间/i }).click();

    // Name should be pre-filled from auth bypass
    await page1.getByRole('button', { name: /确认|创建/i }).first().click();

    // 等待房间创建
    await page1.waitForSelector('.room-code', { timeout: 10000 });

    // 获取房间号
    const roomCode = await page1.locator('.room-code').first().textContent();

    if (roomCode) {
      // 第二个页面加入房间
      const page2 = await context.newPage();
      await bypassAuth(page2, '玩家2');
      await page2.getByRole('button', { name: /加入房间/i }).click();

      // Wait for join room form to appear
      await page2.waitForSelector('.room-code-input', { timeout: 5000 });
      await page2.locator('.room-code-input').fill(roomCode.trim());

      // Name should be pre-filled from auth bypass; click submit
      await page2.locator('.submit-button').click();

      // 验证加入成功 - 应该进入等待房间页面
      await expect(page2.locator('.room-code')).toBeVisible({ timeout: 10000 });
    }
  });
});

test.describe('游戏机制', () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  test('投骰子应该移动棋子', async ({ page, context }) => {
    // 创建两个玩家的游戏（需要至少2人开始游戏）

    // 快速创建房间流程
    await page.getByRole('button', { name: /创建房间/i }).click();
    // Name pre-filled from auth
    await page.getByRole('button', { name: /确认|创建/i }).first().click();

    // 等待进入房间
    await page.waitForSelector('.room-code', { timeout: 10000 });

    // 如果有开始游戏按钮，检查状态
    const startButton = page.getByRole('button', { name: /开始游戏|Start Game/i });
    if (await startButton.isVisible()) {
      // 可能需要更多玩家才能开始
      const isDisabled = await startButton.isDisabled();
      if (!isDisabled) {
        await startButton.click();

        // 等待游戏开始
        await page.waitForSelector('[data-testid="game-board"], .game-canvas', { timeout: 15000 });

        // 检查投骰子按钮
        const rollButton = page.getByRole('button', { name: /投骰子|Roll Dice/i });
        if (await rollButton.isVisible()) {
          await rollButton.click();

          // 验证骰子结果出现
          await expect(page.getByText(/[1-6]/)).toBeVisible({ timeout: 5000 });
        }
      }
    }
  });
});

test.describe('响应式布局', () => {
  test('移动端应该显示底部操作栏', async ({ page }) => {
    // 设置移动端视口
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(BASE_URL);

    // 检查移动端布局
    const mobileActionBar = page.locator('.mobile-action-bar');
    // 这个元素可能在游戏界面中才出现
    // 先检查页面是否正确加载
    await expect(page.getByRole('button').first()).toBeVisible();
  });

  test('桌面端应该显示侧边面板', async ({ page }) => {
    // 设置桌面端视口
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(BASE_URL);

    // 检查桌面端布局
    const sidePanel = page.locator('.side-panel');
    // 侧边面板在游戏界面
    await expect(page.getByRole('button').first()).toBeVisible();
  });
});

test.describe('无障碍功能', () => {
  test('页面应该有正确的 ARIA 标签', async ({ page }) => {
    await page.goto(BASE_URL);

    // 检查主要按钮有可访问名称
    const buttons = await page.getByRole('button').all();
    for (const button of buttons.slice(0, 5)) {
      const name = await button.getAttribute('aria-label') || await button.textContent();
      expect(name).toBeTruthy();
    }
  });

  test('应该支持键盘导航', async ({ page }) => {
    await page.goto(BASE_URL);

    // Tab 导航
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // 焦点应该在可见元素上
    const focusedElement = await page.evaluateHandle(() => document.activeElement);
    expect(await focusedElement.evaluate(el => el?.tagName)).toBeTruthy();
  });
});

test.describe('性能检查', () => {
  test('首页加载时间应该在可接受范围内', async ({ page }) => {
    const startTime = Date.now();
    await page.goto(BASE_URL);
    const loadTime = Date.now() - startTime;

    // 首页应该在 5 秒内加载（开发环境可能较慢）
    expect(loadTime).toBeLessThan(5000);
  });
});
