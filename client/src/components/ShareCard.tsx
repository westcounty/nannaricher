import { useState, useRef, useCallback } from 'react';

interface ShareCardProps {
  winnerName: string;
  winCondition: string;
  money: number;
  gpa: number;
  exploration: number;
  roundNumber: number;
  playerCount: number;
  rankings: Array<{ name: string; rank: number }>;
  onClose: () => void;
}

export function ShareCard(props: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const generate = useCallback(async () => {
    setGenerating(true);
    await document.fonts.load('bold 28px "Noto Sans SC"');
    await document.fonts.ready;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const W = 750, H = 1334;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d')!;

    // Background
    ctx.fillStyle = '#F5EDE0';
    ctx.fillRect(0, 0, W, H);

    // Title area (purple gradient)
    const titleGrad = ctx.createLinearGradient(0, 0, W, 200);
    titleGrad.addColorStop(0, '#5B2D8E');
    titleGrad.addColorStop(1, '#7B4DB8');
    ctx.fillStyle = titleGrad;
    ctx.fillRect(0, 0, W, 200);

    ctx.fillStyle = '#FFB300';
    ctx.font = 'bold 42px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🎓 菜根人生', W / 2, 90);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '22px "Noto Sans SC", sans-serif';
    ctx.fillText('南大版大富翁', W / 2, 140);

    // Winner area
    ctx.fillStyle = '#2A2018';
    ctx.font = 'bold 36px "Noto Sans SC", sans-serif';
    ctx.fillText(`🏆 ${props.winnerName} 获胜！`, W / 2, 300);
    ctx.fillStyle = '#5B2D8E';
    ctx.font = '20px "Noto Sans SC", sans-serif';
    const conditionText = props.winCondition.length > 30
      ? props.winCondition.slice(0, 28) + '...'
      : props.winCondition;
    ctx.fillText(conditionText, W / 2, 350);

    // Data area
    const y0 = 440;
    ctx.fillStyle = 'rgba(91,45,142,0.08)';
    ctx.beginPath();
    ctx.roundRect(60, y0 - 40, W - 120, 120, 16);
    ctx.fill();

    ctx.fillStyle = '#2A2018';
    ctx.font = 'bold 26px "Noto Sans SC", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `💰 ${props.money}   📚 ${props.gpa.toFixed(1)}   🐋 ${props.exploration}`,
      W / 2, y0 + 10
    );
    ctx.font = '18px "Noto Sans SC", sans-serif';
    ctx.fillStyle = '#666';
    ctx.fillText(
      `⏱ ${props.roundNumber}回合  ·  👥 ${props.playerCount}人局`,
      W / 2, y0 + 50
    );

    // Rankings
    const ry = 620;
    ctx.textAlign = 'left';
    const medals = ['🥇', '🥈', '🥉'];
    props.rankings.slice(0, 6).forEach((r, i) => {
      ctx.fillStyle = i === 0 ? '#5B2D8E' : '#2A2018';
      ctx.font = i === 0 ? 'bold 24px "Noto Sans SC", sans-serif' : '22px "Noto Sans SC", sans-serif';
      const medal = i < 3 ? medals[i] : `  ${i + 1}.`;
      ctx.fillText(`    ${medal}  ${r.name}`, 120, ry + i * 50);
    });

    // Footer
    ctx.textAlign = 'center';
    ctx.fillStyle = '#5B2D8E';
    ctx.font = 'bold 24px "Noto Sans SC", sans-serif';
    ctx.fillText('richer.nju.top', W / 2, H - 120);
    ctx.fillStyle = '#999';
    ctx.font = '18px "Noto Sans SC", sans-serif';
    ctx.fillText('来南大重走青春路', W / 2, H - 80);

    canvas.toBlob((blob) => {
      if (blob) setImageUrl(URL.createObjectURL(blob));
      setGenerating(false);
    }, 'image/png');
  }, [props]);

  const download = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = '菜根人生-战绩.png';
    a.click();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 10000,
    }} onClick={props.onClose}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: 20,
        maxWidth: 400, maxHeight: '90vh', overflowY: 'auto', textAlign: 'center',
      }} onClick={e => e.stopPropagation()}>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {!imageUrl ? (
          <button
            className="settlement-btn settlement-btn--primary"
            onClick={generate}
            disabled={generating}
            style={{ width: '100%' }}
          >
            {generating ? '生成中...' : '🖼️ 生成分享卡片'}
          </button>
        ) : (
          <>
            <img src={imageUrl} alt="分享卡片" style={{ maxWidth: '100%', borderRadius: 12 }} />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="settlement-btn settlement-btn--primary" onClick={download} style={{ flex: 1 }}>
                保存图片
              </button>
              <button className="settlement-btn settlement-btn--secondary" onClick={props.onClose} style={{ flex: 1 }}>
                关闭
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
