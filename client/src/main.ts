// Entry point — imports all modules and exposes functions to window for onclick handlers
import { configureLogger } from '../../shared/logger.js';
configureLogger({ level: 'info', server: false });

import { updateSoundUI, toggleSound, setVolume } from './sound.js';
import { duckSay, quackDuck } from './duck.js';
import { checkAuth } from './api.js';
import { doLogin, togglePasswordVis, updateLockoutUI } from './auth.js';
import { addScope, removeScope, updateTimeSummary, checkScope, initScope, applyTemplate } from './scope.js';
import { activateStep, reopenStep, completeStep, goBack, pauseAndGoBack } from './steps.js';
import { verifyUnderstanding, requestRescope, copyRescopeField, hideRescope, toggleVrCollapse, toggleCompareMode, toggleVhEntry } from './verify.js';
import { toggleDiffStatus, addExtra, showAmendment, submitAmendment } from './diff.js';
import { toggleWorkTimer } from './timer.js';
import { checkpointYes, checkpointNo, showCreep, hideCreep } from './checkpoint.js';
import { toggleCheck } from './checks.js';
import { shipIt } from './ship.js';
import { renderHistory, resumeTask, cloneTask, deleteTask, templateFromTask, toggleHistory, resetAll } from './history.js';
import { loadDraft } from './draft.js';
import { printPlan, printFinal, exportMarkdown, closeMd, copyMd, copyShipSummary } from './export.js';
import { initShortcuts } from './shortcuts.js';
import { state } from './state.js';
import { applyTheme, toggleTheme } from './theme.js';

// Window bridge — expose all functions used by inline onclick handlers
const w = window as unknown as Record<string, unknown>;
w.doLogin = doLogin;
w.togglePasswordVis = togglePasswordVis;
w.toggleSound = toggleSound;
w.toggleHistory = toggleHistory;
w.toggleWorkTimer = toggleWorkTimer;
w.quackDuck = quackDuck;
w.reopenStep = reopenStep;
w.completeStep = completeStep;
w.goBack = goBack;
w.pauseAndGoBack = pauseAndGoBack;
w.verifyUnderstanding = verifyUnderstanding;
w.requestRescope = requestRescope;
w.copyRescopeField = copyRescopeField;
w.hideRescope = hideRescope;
w.addScope = addScope;
w.removeScope = removeScope;
w.updateTimeSummary = updateTimeSummary;
w.checkScope = checkScope;
w.toggleDiffStatus = toggleDiffStatus;
w.addExtra = addExtra;
w.showAmendment = showAmendment;
w.submitAmendment = submitAmendment;
w.checkpointYes = checkpointYes;
w.checkpointNo = checkpointNo;
w.hideCreep = hideCreep;
w.toggleCheck = toggleCheck;
w.shipIt = shipIt;
w.resumeTask = resumeTask;
w.cloneTask = cloneTask;
w.deleteTask = deleteTask;
w.templateFromTask = templateFromTask;
w.resetAll = resetAll;
w.printPlan = printPlan;
w.printFinal = printFinal;
w.exportMarkdown = exportMarkdown;
w.closeMd = closeMd;
w.copyMd = copyMd;
w.toggleVhEntry = toggleVhEntry;
w.applyTemplate = applyTemplate;
w.toggleCompareMode = toggleCompareMode;
w.toggleVrCollapse = toggleVrCollapse;
w.toggleTheme = toggleTheme;
w.setVolume = setVolume;
w.copyShipSummary = copyShipSummary;

// Init
applyTheme();
updateSoundUI();
initScope();
initShortcuts();

// Check lockout
if (state.clientLockoutUntil > Date.now()) updateLockoutUI();

// Auth & history
checkAuth();
renderHistory();
if (loadDraft()) {
  duckSay("Welcome back! I recovered your draft. Pick up where you left off.");
}
