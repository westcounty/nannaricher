import { useState } from 'react';
import { PLAN_DIFFICULTY, DIFFICULTY_LABEL } from '@nannaricher/shared';

interface RuleDrawerProps {
  open: boolean;
  onClose: () => void;
}

type TabId = 'basics' | 'plans' | 'cards' | 'lines';

const TABS: Array<{ id: TabId; label: string }> = [
  { id: 'basics', label: '基础规则' },
  { id: 'plans', label: '培养计划' },
  { id: 'cards', label: '卡牌' },
  { id: 'lines', label: '支线' },
];

export function RuleDrawer({ open, onClose }: RuleDrawerProps) {
  const [tab, setTab] = useState<TabId>('basics');
  if (!open) return null;

  return (
    <>
      <div className="rule-drawer-backdrop" onClick={onClose} />
      <div className="rule-drawer">
        <div className="rule-drawer__header">
          <h2>📖 游戏规则</h2>
          <button className="rule-drawer__close" onClick={onClose}>✕</button>
        </div>
        <div className="rule-drawer__tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`rule-drawer__tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="rule-drawer__content">
          {tab === 'basics' && <BasicsTab />}
          {tab === 'plans' && <PlansTab />}
          {tab === 'cards' && <CardsTab />}
          {tab === 'lines' && <LinesTab />}
        </div>
      </div>
    </>
  );
}

function BasicsTab() {
  return (
    <div className="rule-section">
      <h3>游戏流程</h3>
      <p>2-6名玩家参与，模拟4年南大校园生活。每年6回合，共24回合。</p>
      <p>每回合：投骰子 → 移动 → 触发格子事件 → 下一位玩家。</p>
      <h3>胜利条件</h3>
      <p><strong>基础胜利：</strong>GPA × 10 + 探索值 ≥ 60</p>
      <p><strong>计划胜利：</strong>完成你主修培养计划的专属胜利条件</p>
      <h3>三大资源</h3>
      <p>💰 <strong>金钱</strong> — 支付入场费、事件费用</p>
      <p>📚 <strong>GPA</strong> — 学业成绩，影响学费和胜利</p>
      <p>🐋 <strong>探索值</strong> — 课外活动积累，影响胜利</p>
      <h3>特殊格子</h3>
      <p>🏠 <strong>起点</strong> — 经过+500，停留+600</p>
      <p>🏥 <strong>校医院</strong> — 投≥3离开 或 付250</p>
      <p>🔔 <strong>鼎</strong> — 停留一回合</p>
      <p>🚏 <strong>候车厅</strong> — 付200可传送到任意格</p>
    </div>
  );
}

function PlansTab() {
  const plans = [
    { id: 'plan_tianwen', name: '天文与空间科学学院', condition: '与每位其他玩家同格停留≥2次' },
    { id: 'plan_zhengguan', name: '政府管理学院', condition: '探索值≥20 且 金钱差≤666' },
    { id: 'plan_wenxue', name: '文学院', condition: '离开赚钱线时金钱未增加' },
    { id: 'plan_xiandai', name: '现代工程与应用科学学院', condition: '探索+GPA×10+金钱÷1000 ≥ 60' },
    { id: 'plan_wuli', name: '物理学院', condition: '任意两项指标之和≥85' },
    { id: 'plan_zhexue', name: '哲学系', condition: '完整进出支线且资源无变化' },
    { id: 'plan_shangxue', name: '商学院', condition: '金钱达到5555' },
    { id: 'plan_makesi', name: '马克思主义学院', condition: 'GPA达到4.5' },
    { id: 'plan_huaxue', name: '化学化工学院', condition: '连续6回合触发增益' },
    { id: 'plan_xinwen', name: '新闻传播学院', condition: '经过探索线且无GPA和探索扣减' },
    { id: 'plan_faxue', name: '法学院', condition: '场上出现破产玩家' },
    { id: 'plan_yixue', name: '医学院', condition: '进入医院3次' },
    { id: 'plan_jisuanji', name: '计算机科学与技术系', condition: '探索值和金钱仅含0和1' },
    { id: 'plan_kuangyaming', name: '匡亚明学院', condition: '满足2位其他玩家的计划条件' },
    { id: 'plan_shehuixue', name: '社会学院', condition: '探索值比最低玩家高15-20' },
    { id: 'plan_rengong', name: '人工智能学院', condition: 'GPA比最低玩家高1.5-2' },
    { id: 'plan_gongguan', name: '工程管理学院', condition: '连续6回合金钱≤500' },
    { id: 'plan_shengming', name: '生命科学学院', condition: '食堂线累计3次非负面效果' },
    { id: 'plan_diqiu', name: '地球科学与工程学院', condition: '进入过四个校区线' },
    { id: 'plan_waiguoyu', name: '外国语学院', condition: '抽到2张含英文卡' },
    { id: 'plan_daqi', name: '大气科学学院', condition: '15回合不持有最多金钱' },
    { id: 'plan_huanjing', name: '环境学院', condition: '仙林线5+事件' },
    { id: 'plan_dianzi', name: '电子科学与工程学院', condition: '连续路过特定格子' },
    { id: 'plan_ruanjian', name: '软件学院', condition: '特定资源条件达成' },
    { id: 'plan_xinxi', name: '信息管理学院', condition: '收集特定卡牌组合' },
    { id: 'plan_shuxue', name: '数学系', condition: '可指定骰子点数（被动能力）' },
    { id: 'plan_lishi', name: '历史学院', condition: '特定支线完成条件' },
    { id: 'plan_jianzhu', name: '建筑与城市规划学院', condition: '特定格子组合达成' },
    { id: 'plan_yishu', name: '艺术学院', condition: '特定资源比例达成' },
    { id: 'plan_guoji', name: '国际关系学院', condition: '特定外交条件达成' },
    { id: 'plan_suzhou', name: '苏州校区', condition: '苏州线特定条件达成' },
    { id: 'plan_haiwai', name: '海外教育学院', condition: '特定出国条件达成' },
    { id: 'plan_dili', name: '地理与海洋科学学院', condition: '特定地理条件达成' },
  ];

  return (
    <div className="rule-section">
      <p className="rule-section__intro">
        大二起每年选择1-2个培养计划。主修计划的被动能力生效，达成胜利条件也可获胜。
      </p>
      {plans.map(p => {
        const diff = PLAN_DIFFICULTY[p.id];
        return (
          <div key={p.id} className="rule-plan-item">
            <div className="rule-plan-item__header">
              <strong>{p.name}</strong>
              {diff && <span className="plan-difficulty-badge" style={{ marginLeft: 6, fontSize: '0.7rem', color: diff === 'easy' ? 'var(--c-success)' : diff === 'hard' ? 'var(--c-danger)' : 'var(--c-accent)', borderColor: diff === 'easy' ? 'var(--c-success)' : diff === 'hard' ? 'var(--c-danger)' : 'var(--c-accent)' }}>{DIFFICULTY_LABEL[diff]}</span>}
            </div>
            <div className="rule-plan-item__condition">{p.condition}</div>
          </div>
        );
      })}
    </div>
  );
}

function CardsTab() {
  return (
    <div className="rule-section">
      <h3>两种卡牌</h3>
      <p>🔵 <strong>机会卡</strong> — 踩到机会格抽取，多为资源增减</p>
      <p>🟣 <strong>命运卡</strong> — 踩到命运格抽取，效果更戏剧化</p>
      <h3>卡牌类型</h3>
      <p>⚡ <strong>即时卡</strong> — 抽到立即生效</p>
      <p>🎴 <strong>保留卡</strong> — 可保留在手中，择机使用</p>
      <p>🛡️ <strong>响应卡</strong> — 可在他人回合使用，抵消不利效果</p>
      <p>🗳️ <strong>投票卡</strong> — 触发全体投票决定结果</p>
      <p>🔗 <strong>连锁卡</strong> — 多人依次响应的连锁效果</p>
    </div>
  );
}

function LinesTab() {
  const lines = [
    { name: '浦口线', fee: '免费（强制）', desc: '浦口校区生活体验，事件丰富但风险较高' },
    { name: '食堂线', fee: '免费（强制）', desc: '各食堂美食探索，以探索值收益为主' },
    { name: '学在南哪', fee: '200', desc: 'GPA 提升专线，适合追求学术胜利' },
    { name: '赚在南哪', fee: '200', desc: '金钱收益最高的线路，但有损失风险' },
    { name: '乐在南哪', fee: '200', desc: '探索值收益最高，社团和活动丰富' },
    { name: '鼓楼线', fee: '200', desc: '鼓楼校区，大一GPA收益翻倍' },
    { name: '仙林线', fee: '200', desc: '仙林校区日常，收益偏低但稳定' },
    { name: '苏州线', fee: '200', desc: '苏州校区体验，综合收益均衡' },
  ];

  return (
    <div className="rule-section">
      <p className="rule-section__intro">
        踩到支线入口时可选择是否进入（浦口/食堂为强制）。进入后依次经过支线格子，到达终点返回主棋盘。
      </p>
      {lines.map(l => (
        <div key={l.name} className="rule-line-item">
          <div className="rule-line-item__header">
            <strong>{l.name}</strong>
            <span className="rule-line-item__fee">入场费: {l.fee}</span>
          </div>
          <div className="rule-line-item__desc">{l.desc}</div>
        </div>
      ))}
    </div>
  );
}
