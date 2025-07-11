// packages/core/command-handlers/src/ws-command-handlers.ts
import { throwAppError } from '@bangle.io/base-utils';
import { WsDirPath, WsPath } from '@bangle.io/ws-path';
import { c, getCtx } from './helper';

import { validateInputPath } from './utils';

export const wsCommandHandlers = [
  c('command::ws:new-note-from-input', ({ navigation }, { inputPath }, key) => {
    const { dispatch } = getCtx(key);
    validateInputPath(inputPath);

    const { wsName } = navigation.resolveAtoms();

    if (!wsName) {
      throwAppError(
        'error::workspace:not-opened',
        t.app.errors.workspace.notOpened,
        {
          wsPath: inputPath,
        },
      );
    }

    // Add .md extension if not present
    if (!inputPath.endsWith(WsPath.DEFAULT_NOTE_EXTENSION)) {
      inputPath = inputPath + WsPath.DEFAULT_NOTE_EXTENSION;
    }
    const wsPath = WsPath.fromParts(wsName, inputPath).toString();

    dispatch('command::ws:create-note', { wsPath, navigate: true });
  }),

  c(
    'command::ws:create-note',
    ({ fileSystem, navigation }, { wsPath, navigate }) => {
      const parsedPath = WsPath.fromString(wsPath);
      const wsName = parsedPath.wsName;

      if (!wsName) {
        throwAppError(
          'error::workspace:not-opened',
          t.app.errors.workspace.notOpened,
          {
            wsPath,
          },
        );
      }

      const filePath = WsPath.assertFile(wsPath);
      const fileNameWithoutExt = filePath.fileNameWithoutExtension;

      void fileSystem
        .createFile(
          wsPath,
          new File([''], fileNameWithoutExt, {
            type: 'text/plain',
          }),
        )
        .then(() => {
          if (navigate) {
            navigation.goWsPath(wsPath);
          }
        });
    },
  ),

  c('command::ws:go-workspace', ({ navigation }, { wsName }) => {
    navigation.goWorkspace(wsName);
  }),
  c('command::ws:go-ws-path', ({ navigation }, { wsPath }) => {
    navigation.goWsPath(wsPath);
  }),

  c(
    'command::ws:delete-workspace',
    ({ workspaceOps, navigation }, { wsName }) => {
      workspaceOps.deleteWorkspaceInfo(wsName).then(() => {
        if (navigation.resolveAtoms().wsName === wsName) {
          navigation.goHome();
        }
      });
    },
  ),

  c('command::ws:delete-ws-path', ({ fileSystem, navigation }, { wsPath }) => {
    if (navigation.resolveAtoms().wsPath?.wsPath === wsPath) {
      navigation.goWorkspace();
    }
    fileSystem.deleteFile(wsPath);
  }),

  c(
    'command::ws:rename-ws-path',
    ({ fileSystem, navigation }, { wsPath, newWsPath }) => {
      const oldPath = WsPath.fromString(wsPath);
      const newPath = WsPath.fromString(newWsPath);

      if (!oldPath.wsName) {
        throwAppError(
          'error::workspace:not-opened',
          t.app.errors.workspace.notOpened,
          {
            wsPath,
          },
        );
      }

      if (oldPath.wsName !== newPath.wsName) {
        throwAppError(
          'error::file:invalid-operation',
          t.app.errors.file.cannotRenameToDifferentWorkspace,
          {
            operation: 'rename',
            oldWsPath: wsPath,
            newWsPath,
          },
        );
      }

      const needsRedirect = navigation.resolveAtoms().wsPath?.wsPath === wsPath;
      if (needsRedirect) {
        navigation.goWorkspace();
      }

      void fileSystem
        .renameFile({
          oldWsPath: wsPath,
          newWsPath,
        })
        .then(() => {
          if (needsRedirect) {
            navigation.goWsPath(newWsPath);
          }
        });
    },
  ),

  c(
    'command::ws:move-ws-path',
    (
      { fileSystem, navigation, workspaceState },
      { wsPath, destDirWsPath },
      key,
    ) => {
      const { store } = getCtx(key);

      const filePath = WsPath.assertFile(wsPath);
      const destDir = WsPath.fromString(destDirWsPath).asDir();
      if (!destDir) {
        throwAppError(
          'error::workspace:not-opened',
          t.app.errors.workspace.notOpened,
          {
            wsPath,
          },
        );
      }

      const newWsPath = destDir.createFilePath(filePath.fileName).wsPath;

      if (wsPath === newWsPath) {
        return;
      }

      const existingWsPaths = store
        .get(workspaceState.$wsPaths)
        .map((path) => path.wsPath);
      if (existingWsPaths.includes(newWsPath)) {
        throwAppError(
          'error::file:already-existing',
          t.app.errors.file.alreadyExistsInDest,
          {
            wsPath: newWsPath,
          },
        );
      }

      const needsRedirect = navigation.resolveAtoms().wsPath?.wsPath === wsPath;
      if (needsRedirect) {
        navigation.goWorkspace();
      }

      void fileSystem
        .renameFile({
          oldWsPath: wsPath,
          newWsPath,
        })
        .then(() => {
          if (needsRedirect) {
            navigation.goWsPath(newWsPath);
          }
        });
    },
  ),

  c('command::ws:quick-new-note', ({ workspaceState }, { pathPrefix }, key) => {
    const { store, dispatch } = getCtx(key);
    const wsPaths = store.get(workspaceState.$wsPaths) || [];

    const untitledNotes = wsPaths
      .map((path) => path.fileNameWithoutExtension)
      .filter((name) => name.startsWith('untitled-'))
      .map((name) => {
        const num = Number.parseInt(name.replace('untitled-', ''));
        return Number.isNaN(num) ? 0 : num;
      });

    const nextNum =
      untitledNotes.length > 0 ? Math.max(...untitledNotes) + 1 : 1;
    const newNoteName = `untitled-${nextNum}`;

    dispatch('command::ws:new-note-from-input', {
      inputPath: pathPrefix
        ? WsPath.pathJoin(pathPrefix, newNoteName)
        : newNoteName,
    });
  }),

  c('command::ws:create-directory', (_, { dirWsPath }, key) => {
    const { dispatch } = getCtx(key);
    const dirPath = WsPath.fromString(dirWsPath).asDir();

    if (!dirPath) {
      throwAppError(
        'error::ws-path:invalid-ws-path',
        t.app.errors.wsPath.invalidDirectoryPath,
        {
          invalidPath: dirWsPath,
        },
      );
    }
    // We do not support bare directories, so create a note as a placeholder
    dispatch('command::ws:quick-new-note', {
      pathPrefix: dirPath.path,
    });
  }),
  c('command::ws:go-ws-home', ({ navigation }) => {
    navigation.goWorkspace();
  }),

  c(
    'command::ws:clone-note',
    async ({ workspaceState, fileSystem, navigation }, _args, key) => {
      const { store } = getCtx(key);
      const currentWsPath = store.get(workspaceState.$currentWsPath);

      if (!currentWsPath) {
        throwAppError(
          'error::workspace:not-opened',
          t.app.errors.workspace.noNoteOpenToClone,
          {},
        );
      }

      // Determine base name by stripping any existing '-copy-<n>' suffix
      const origName = currentWsPath.fileNameWithoutExtension;
      const copyRegex = /^(.*?)(-copy-\d+)?$/;
      const match = origName.match(copyRegex);
      const base = match ? match[1] : origName;

      // Get all sibling notes in the same directory
      const wsNotes = store.get(workspaceState.$wsPaths);
      const siblingNames = new Set<string>();
      for (const note of wsNotes) {
        const noteParsed = WsPath.fromString(note.wsPath);
        const noteFile = noteParsed.asFile();
        if (noteFile) {
          const noteParent = noteFile.getParent();
          if (noteParent?.path === currentWsPath.getParent()?.path) {
            siblingNames.add(noteFile.fileNameWithoutExtension);
          }
        }
      }

      // Find the smallest copy number that is not already used
      let copyNumber = 1;
      let candidate = `${base}-copy-${copyNumber}`;
      while (siblingNames.has(candidate)) {
        copyNumber++;
        candidate = `${base}-copy-${copyNumber}`;
      }

      const newFileName = candidate + WsPath.DEFAULT_NOTE_EXTENSION;

      // Use replaceFileName to create the new WsPath
      const newWsPath = currentWsPath.replaceFileName(newFileName).wsPath;

      const originalFile = await fileSystem.readFile(currentWsPath.wsPath);
      if (!originalFile) {
        throwAppError(
          'error::file:invalid-note-path',
          t.app.errors.file.originalNoteNotFound,
          {
            invalidWsPath: currentWsPath.wsPath,
          },
        );
      }
      const content = await originalFile.text();

      await fileSystem.createFile(
        newWsPath,
        new File([content], newFileName, { type: 'text/plain' }),
      );

      navigation.goWsPath(newWsPath);
    },
  ),

  c(
    'command::ws:daily-note',
    async ({ workspaceState, fileSystem, navigation }, args, key) => {
      const { store, dispatch } = getCtx(key);
      const wsName = store.get(workspaceState.$currentWsName);
      const currentWsPath = store.get(workspaceState.$currentWsPath);

      if (!wsName) {
        throwAppError(
          'error::workspace:not-opened',
          t.app.errors.workspace.noWorkspaceForDailyNote,
          {},
        );
      }

      const today = args?.date ? new Date(args.date) : new Date();

      // Format date as YYYY-MMM-DD
      const year = today.getFullYear();
      const monthNames = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec',
      ];
      const month = monthNames[today.getMonth()];
      const day = String(today.getDate()).padStart(2, '0');
      const formattedDate = `${year}-${month}-${day}`;
      const fileName = `${formattedDate}-daily${WsPath.DEFAULT_NOTE_EXTENSION}`;

      const parentDir =
        currentWsPath?.getParent() || WsDirPath.fromString(`${wsName}:`);

      const dailyNotePath = parentDir.createFilePath(fileName);
      const dailyNoteWsPath = dailyNotePath.wsPath;

      const exists = await fileSystem.exists(dailyNoteWsPath);

      if (exists) {
        navigation.goWsPath(dailyNoteWsPath);
      } else {
        dispatch('command::ws:create-note', {
          wsPath: dailyNoteWsPath,
          navigate: true,
        });
      }
    },
  ),

  c(
    'command::workspace:toggle-star',
    async (
      { workspaceState, userActivityService },
      { wsPath: argWsPath },
      key,
    ) => {
      const { store } = getCtx(key);
      const currentOpenWsPath = store.get(
        workspaceState.$currentWsPath,
      )?.wsPath;
      const wsPathToToggleString = argWsPath ?? currentOpenWsPath;

      if (!wsPathToToggleString) {
        throwAppError(
          'error::workspace:no-note-opened',
          t.app.errors.workspace.noNoteOpened,
          {},
        );
        return;
      }

      await userActivityService.toggleStarItem(
        WsPath.fromString(wsPathToToggleString),
      );
    },
  ),
];
