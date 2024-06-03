import { createSourceSection, SourceSection } from './source-section';
import { TsModule } from './ts-module';
import { sliceModule } from '../slice/module-slice';


/* ****************************************************************************************************************** */
// region: Types
/* ****************************************************************************************************************** */

export interface ModuleSource {
  fileHeader: SourceSection;
  bodyHeader?: SourceSection;
  body: SourceSection[];
  fileFooter?: SourceSection;
  usesTsNamespace: boolean;
  getSections(): [ sectionName: SourceSection['sectionName'], section: SourceSection | undefined ][];
  bodyWrapper?: {
    start: string;
    end: string;
  }
}

// endregion


/* ****************************************************************************************************************** */
// region: Utils
/* ****************************************************************************************************************** */

export function getModuleSource(tsModule: TsModule): ModuleSource {
  const moduleFile = tsModule.getUnpatchedModuleFile();

  const { firstSourceFileStart, fileEnd, wrapperPos, bodyPos, sourceFileStarts, bodyWrapper } =
    sliceModule(moduleFile, tsModule.package.version);

  const fileHeaderEnd = wrapperPos?.start ?? firstSourceFileStart;

  return {
    fileHeader: createSourceSection(moduleFile, 'file-header', 0, fileHeaderEnd),
    bodyHeader: wrapperPos && createSourceSection(moduleFile, 'body-header', bodyPos.start, firstSourceFileStart, 2),
    body: sourceFileStarts.map(([ srcFileName, startPos ], i) => {
      const endPos = sourceFileStarts[i + 1]?.[1] ?? bodyPos?.end ?? fileEnd;
      return createSourceSection(moduleFile, 'body', startPos, endPos, wrapperPos != null ? 2 :0, srcFileName);
    }),
    fileFooter: wrapperPos && createSourceSection(moduleFile, 'file-footer', wrapperPos.end, fileEnd),
    usesTsNamespace: wrapperPos != null,
    getSections() {
      return [
        [ 'file-header', this.fileHeader ],
        [ 'body-header', this.bodyHeader ],
        ...this.body.map((section, i) => [ `body`, section ] as [ SourceSection['sectionName'], SourceSection ]),
        [ 'file-footer', this.fileFooter ],
      ];
    },
    bodyWrapper,
  }
}

// endregion
