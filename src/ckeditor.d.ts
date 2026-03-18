declare module '@ckeditor/ckeditor5-react' {
    import React from 'react';
    import ClassicEditor from '@ckeditor/ckeditor5-build-classic';
    import { EditorConfig } from '@ckeditor/ckeditor5-core/src/editor/editorconfig';

    export class CKEditor extends React.Component<{
        disabled?: boolean;
        editor: any;
        data?: string;
        id?: string;
        config?: EditorConfig;
        onReady?: (editor: any) => void;
        onChange?: (event: any, editor: any) => void;
        onBlur?: (event: any, editor: any) => void;
        onFocus?: (event: any, editor: any) => void;
        onError?: (event: any, editor: any) => void;
    }> {}
}

declare module '@ckeditor/ckeditor5-build-classic' {
    const ClassicEditor: any;
    export = ClassicEditor;
}
