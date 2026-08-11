import type { Match, MatchEvent } from '@/lib/supabase';

export interface CardData {
  match: Match;
  events: (MatchEvent & {
    profiles?: { nome: string; apelido: string | null } | null;
    guests?: { nome: string } | null;
  })[];
}

const W = 1080;
const H = 1350;

const COLORS = {
  bgDark: '#0a0a0a',
  bgGradientTop: '#171717',
  red: '#dc2626',
  redBright: '#ef4444',
  white: '#ffffff',
  grayLight: '#d4d4d4',
  grayMid: '#a3a3a3',
  grayDark: '#525252',
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    if (!src) { resolve(null); return; }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, COLORS.bgGradientTop);
  grad.addColorStop(0.5, '#0f0f0f');
  grad.addColorStop(1, COLORS.bgDark);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.translate(W * 0.72, H * 0.2);
  ctx.rotate(-0.42);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.045)';
  ctx.fillRect(-W, -60, W * 2, 120);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.025)';
  ctx.fillRect(-W, -140, W * 2, 50);
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.012)';
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawWatermark(ctx: CanvasRenderingContext2D, crest: HTMLImageElement | null) {
  if (!crest) return;
  ctx.save();
  ctx.globalAlpha = 0.05;
  const wmSize = 600;
  ctx.drawImage(crest, W / 2 - wmSize / 2, H / 2 - wmSize / 2, wmSize, wmSize);
  ctx.restore();
}

function drawTopBar(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, 0, W, 8);

  ctx.save();
  ctx.translate(W * 0.72, H * 0.42);
  ctx.rotate(-0.42);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.06)';
  ctx.fillRect(-W, -120, W * 2, 240);
  ctx.restore();
}

function drawBottomBar(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, H - 8, W, 8);
}

function drawHeader(ctx: CanvasRenderingContext2D, title: string) {
  ctx.textAlign = 'center';
  ctx.fillStyle = COLORS.red;
  ctx.font = 'bold 52px Inter, system-ui, sans-serif';
  ctx.fillText(title, W / 2, 130);

  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 80, 155);
  ctx.lineTo(W / 2 + 80, 155);
  ctx.stroke();
}

function drawLogoBox(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  cx: number,
  cy: number,
  size: number,
  fallbackText: string,
) {
  ctx.save();
  const x = cx - size / 2;
  const y = cy - size / 2;

  if (img) {
    const minDim = Math.min(img.width, img.height);
    const srcX = (img.width - minDim) / 2;
    const srcY = (img.height - minDim) / 2;
    ctx.save();
    roundRect(ctx, x, y, size, size, 24);
    ctx.clip();
    ctx.drawImage(img, srcX, srcY, minDim, minDim, x, y, size, size);
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, size, size, 24);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, x, y, size, size, 24);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, size, size, 24);
    ctx.stroke();

    ctx.fillStyle = COLORS.grayDark;
    ctx.font = 'bold 64px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(fallbackText.charAt(0).toUpperCase(), cx, cy);
  }
  ctx.restore();
}

function drawTeamName(ctx: CanvasRenderingContext2D, name: string, cx: number, y: number) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const fontSize = name.length > 18 ? 32 : 38;
  ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = COLORS.white;
  ctx.fillText(name.toUpperCase(), cx, y);
}

function formatDateParts(dateStr: string): { day: string; month: string; year: string } {
  const d = new Date(dateStr + 'T00:00:00');
  const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
  return {
    day: String(d.getDate()).padStart(2, '0'),
    month: months[d.getMonth()],
    year: String(d.getFullYear()),
  };
}

function drawInfoRow(ctx: CanvasRenderingContext2D, label: string, value: string, y: number) {
  ctx.textAlign = 'center';
  ctx.font = '600 24px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.grayMid;
  ctx.fillText(label.toUpperCase(), W / 2, y);

  ctx.font = 'bold 36px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.white;
  ctx.fillText(value, W / 2, y + 42);
}

function drawCompetitionBadge(ctx: CanvasRenderingContext2D, text: string, y: number) {
  if (!text) return;
  ctx.font = 'bold 22px Inter, system-ui, sans-serif';
  const metrics = ctx.measureText(text.toUpperCase());
  const padding = 28;
  const bw = metrics.width + padding * 2;
  const bh = 48;
  const bx = W / 2 - bw / 2;
  const by = y;

  ctx.fillStyle = 'rgba(220, 38, 38, 0.15)';
  roundRect(ctx, bx, by, bw, bh, 24);
  ctx.fill();
  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 1.5;
  roundRect(ctx, bx, by, bw, bh, 24);
  ctx.stroke();

  ctx.fillStyle = COLORS.redBright;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text.toUpperCase(), W / 2, by + bh / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

function getEventName(ev: CardData['events'][number]): string {
  return ev.profiles?.apelido || ev.profiles?.nome || ev.guests?.nome || '—';
}

export async function renderUpcomingCard(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  crestImg: HTMLImageElement | null,
  opponentImg: HTMLImageElement | null,
): Promise<void> {
  const { match } = data;

  drawBackground(ctx);
  drawWatermark(ctx, crestImg);
  drawTopBar(ctx);
  drawBottomBar(ctx);
  drawHeader(ctx, 'PRÓXIMO JOGO');

  const logoSize = 280;
  const alifCx = W * 0.27;
  const oppCx = W * 0.73;
  const logoY = 430;

  drawLogoBox(ctx, crestImg, alifCx, logoY, logoSize, 'A');
  drawLogoBox(ctx, opponentImg, oppCx, logoY, logoSize, match.adversario || '?');

  ctx.fillStyle = COLORS.red;
  ctx.font = 'bold 56px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', W / 2, logoY);
  ctx.textBaseline = 'alphabetic';

  drawTeamName(ctx, 'AL-IF FC', alifCx, logoY + logoSize / 2 + 50);
  drawTeamName(ctx, match.adversario || 'ADVERSÁRIO', oppCx, logoY + logoSize / 2 + 50);

  const dateParts = formatDateParts(match.data);
  const dateStr = `${dateParts.day} ${dateParts.month} ${dateParts.year}`;

  let infoY = 850;
  drawInfoRow(ctx, 'Data', dateStr, infoY);
  infoY += 95;

  if (match.horario) {
    drawInfoRow(ctx, 'Horário', match.horario, infoY);
    infoY += 95;
  }
  if (match.local) {
    drawInfoRow(ctx, 'Local', match.local, infoY);
    infoY += 95;
  }

  const compName = match.competicao || '';
  if (compName) {
    drawCompetitionBadge(ctx, compName, infoY);
    infoY += 68;
  }

  if (match.tipo && match.tipo !== 'Amistoso') {
    ctx.textAlign = 'center';
    ctx.font = '600 22px Inter, system-ui, sans-serif';
    ctx.fillStyle = COLORS.grayMid;
    ctx.fillText(match.tipo.toUpperCase(), W / 2, infoY);
  }
}

export async function renderCompletedCard(
  ctx: CanvasRenderingContext2D,
  data: CardData,
  crestImg: HTMLImageElement | null,
  opponentImg: HTMLImageElement | null,
): Promise<void> {
  const { match, events } = data;

  drawBackground(ctx);
  drawWatermark(ctx, crestImg);
  drawTopBar(ctx);
  drawBottomBar(ctx);
  drawHeader(ctx, 'FINAL DE JOGO');

  const logoSize = 200;
  const alifCx = W * 0.22;
  const oppCx = W * 0.78;
  const logoY = 360;

  drawLogoBox(ctx, crestImg, alifCx, logoY, logoSize, 'A');
  drawLogoBox(ctx, opponentImg, oppCx, logoY, logoSize, match.adversario || '?');

  drawTeamName(ctx, 'AL-IF FC', alifCx, logoY + logoSize / 2 + 45);
  drawTeamName(ctx, match.adversario || 'ADVERSÁRIO', oppCx, logoY + logoSize / 2 + 45);

  const scoreY = 360;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 120px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.white;
  ctx.fillText(String(match.gols_alif ?? 0), W / 2 - 70, scoreY);

  ctx.font = 'bold 60px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.red;
  ctx.fillText('×', W / 2, scoreY);

  ctx.font = 'bold 120px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.white;
  ctx.fillText(String(match.gols_adversario ?? 0), W / 2 + 70, scoreY);
  ctx.textBaseline = 'alphabetic';

  const dateParts = formatDateParts(match.data);
  const dateStr = `${dateParts.day} ${dateParts.month} ${dateParts.year}`;
  ctx.textAlign = 'center';
  ctx.font = '600 28px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.grayMid;
  ctx.fillText(dateStr, W / 2, 650);

  const compName = match.competicao || '';
  if (compName) {
    drawCompetitionBadge(ctx, compName, 690);
  }

  const goalsStartY = 800;
  ctx.textAlign = 'center';
  ctx.font = 'bold 24px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.red;
  ctx.fillText('GOLS', W / 2, goalsStartY);

  ctx.strokeStyle = COLORS.red;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(W / 2 - 40, goalsStartY + 18);
  ctx.lineTo(W / 2 + 40, goalsStartY + 18);
  ctx.stroke();

 const goals = events.filter(e => e.tipo === 'gol');

if (goals.length === 0) {
  ctx.font = '500 28px Inter, system-ui, sans-serif';
  ctx.fillStyle = COLORS.grayMid;
  ctx.textAlign = 'center';
  ctx.fillText('Sem gols registrados', W / 2, goalsStartY + 70);
} else {
  let y = goalsStartY + 65;

  ctx.textAlign = 'left';

  for (const g of goals) {
    const name = getEventName(g);

    // Ícone do gol
    ctx.font = '32px Inter, system-ui, sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.fillText('⚽', W / 2 - 280, y + 2);

    // Nome do jogador
    ctx.font = '500 30px Inter, system-ui, sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(name, W / 2 - 230, y);

    // Minuto — somente se informado
    if (g.minuto != null) {
      const nameMetrics = ctx.measureText(name);

      ctx.font = '500 26px Inter, system-ui, sans-serif';
      ctx.fillStyle = COLORS.grayMid;
      ctx.fillText(
        `— ${g.minuto}'`,
        W / 2 - 230 + nameMetrics.width + 16,
        y
      );
    }

    y += 52;
  }
}

  if (match.local) {
    ctx.textAlign = 'center';
    ctx.font = '500 24px Inter, system-ui, sans-serif';
    ctx.fillStyle = COLORS.grayDark;
    ctx.fillText(match.local, W / 2, H - 80);
  }
}

export async function renderCard(
  canvas: HTMLCanvasElement,
  data: CardData,
  crestSrc: string,
): Promise<void> {
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  const opponentLogo = data.match.logo_url || '';
  const [crestImg, opponentImg] = await Promise.all([
    loadImage(crestSrc),
    loadImage(opponentLogo),
  ]);

  if (data.match.status === 'completed') {
    await renderCompletedCard(ctx, data, crestImg, opponentImg);
  } else {
    await renderUpcomingCard(ctx, data, crestImg, opponentImg);
  }
}

export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to generate image'));
    }, 'image/png', 1.0);
  });
}

export async function shareCard(canvas: HTMLCanvasElement, filename: string): Promise<'shared' | 'downloaded' | 'copied'> {
  const blob = await canvasToBlob(canvas);
  const file = new File([blob], filename, { type: 'image/png' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'AL-IF FC' });
      return 'shared';
    } catch {
      // user cancelled or share failed — fall through to download
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

export async function downloadCard(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
