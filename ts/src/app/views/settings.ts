// 设置页

import { VIEWS } from '../registry';
import { state } from '../store';
import { updateSettingHtml } from '../update';
import { esc } from '../util';

export function chipsHtml(key: string, options: [string | number | boolean, string][]): string {
  const cur = state.settings[key];
  return (
    '<div class="chips">' +
    options.map(([val, label]) => '<button class="chip' + (cur === val ? ' on' : '') + '" data-act="setting" data-key="' + key + '" data-val="' + esc(JSON.stringify(val)) + '">' + label + '</button>').join('') +
    '</div>'
  );
}

VIEWS.settings = function () {
  return (
    '<main class="page">' +
    '<h1 class="h1">设置</h1><p class="sub">改动会自动保存。</p>' +
    '<div class="section panel set-list">' +
    '<div class="set-row"><div><div class="t">发音口音</div></div><div>' + chipsHtml('accent', [['us', '美式'], ['uk', '英式']]) + '</div></div>' +
    '<div class="set-row"><div><div class="t">发音来源</div></div><div>' +
    chipsHtml('voice', [['auto', '真人发音'], ['browser', '电脑语音']]) +
    '<div class="d">真人发音来自有道词典，需要联网；连不上时会自动改用电脑自带的语音。电脑语音不用联网，但效果取决于你的系统。</div>' +
    '<div class="actions" style="margin-top:12px"><button class="btn small ghost" data-act="testVoice">试听</button></div></div></div>' +
    '<div class="set-row"><div><div class="t">读音</div></div><div class="d" style="margin-top:0">「英 → 中」和「听 → 写」出词时自动朗读，按 Tab 再听一遍；「中 → 英」不出声。</div></div>' +
    '<div class="set-row"><div><div class="t">每组几个词</div></div><div>' + chipsHtml('size', [[5, '5'], [10, '10'], [15, '15'], [20, '20']]) + '</div></div>' +
    '<div class="set-row"><div><div class="t">强制全对</div></div><div>' + chipsHtml('forceAll', [[true, '开'], [false, '关']]) +
    '<div class="d">背单词和词根时，一组词在某一步（如「英 → 中」）只要错一个，这一步做完后整组再来一遍，直到全对才进入下一步。</div></div></div>' +
    '<div class="set-row"><div><div class="t">拼错后照打一遍</div></div><div>' + chipsHtml('copyWrong', [[true, '开'], [false, '关']]) +
    '<div class="d">拼写题答错后，照着正确拼写再打一遍，免得记住错的拼法。直接按 Enter 可以跳过。</div></div></div>' +
    '<div class="set-row"><div><div class="t">字母个数提示</div></div><div>' + chipsHtml('letterHint', [[true, '显示'], [false, '不显示']]) +
    '<div class="d">拼写题下面显示 _ _ _ _，提示单词有几个字母。</div></div></div>' +
    '<div class="set-row"><div><div class="t">宠物在页面上走动</div></div><div>' + chipsHtml('petRoam', [[true, '开'], [false, '关']]) +
    '<div class="d">陪你背单词的宠物在页面上走动、说话。</div></div></div>' +
    '<div class="set-row"><div><div class="t">外观</div></div><div>' + chipsHtml('theme', [['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']]) + '</div></div>' +
    '<div class="set-row"><div><div class="t">字体粗细</div></div><div>' + chipsHtml('weight', [['light', '细'], ['normal', '标准'], ['bold', '粗']]) +
    '<div class="d">仿宋本身笔画比较细，觉得还是细就选「粗」。</div></div></div>' +
    (!/^https?:$/.test(location.protocol)
      ? ''
      : '<div class="set-row"><div><div class="t">下载到电脑</div></div><div><a class="btn small ghost" href="Margin.html" download="Marginal Vocabulary.html">下载 Marginal Vocabulary.html</a>' +
        '<div class="d">下载后双击就能打开，不用联网。进度不会自动带过去，需要的话先导出备份，再在下载的版本里导入。</div></div></div>') +
    updateSettingHtml() +
    '<div class="set-row"><div><div class="t">数据备份</div><div class="d">进度只保存在这台电脑的这个浏览器里。</div></div><div>' +
    '<div class="actions"><button class="btn small" data-act="exportData">导出备份</button>' +
    '<label class="btn small ghost file-pick">导入备份<input type="file" id="backup-file" accept=".json,application/json"></label>' +
    '<button class="link" data-act="resetAll">清空所有数据</button></div>' +
    '<div class="d">换电脑、换浏览器或清理浏览器数据之前，先导出备份；到新地方打开 Marginal Vocabulary 后再导入。</div></div></div>' +
    '<div class="set-row"><div><div class="t">关于</div></div><div class="d" style="margin-top:0">Marginal Vocabulary · 背单词工具。<br>Finance、MacroFin、Medicine 词库和词根由 Marginal Vocabulary 整理，译名参考国内通行教材和标准术语；发现不准欢迎到 GitHub 反馈。<br>CET-4、CET-6、GEE、TOEFL、IELTS、GRE、GMAT 词库与音标来自开源词典 ECDICT（MIT 许可证）。</div></div>' +
    '</div>' +
    '</main>'
  );
};
