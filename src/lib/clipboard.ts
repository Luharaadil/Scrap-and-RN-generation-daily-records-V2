import { format } from 'date-fns';

export const copyBlobToClipboard = async (
  blobPromise: Promise<Blob | null>,
  fallbackFilename: string = 'download'
): Promise<boolean> => {
  try {
    // Try the Promise-based approach first (supported in newer browsers)
    // This maintains the user gesture context
    const item = new ClipboardItem({
      'image/png': blobPromise.then(blob => {
        if (!blob) throw new Error('Blob generation failed');
        return blob;
      })
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.warn('Promise-based clipboard write failed, trying fallback...', err);
    
    try {
      const blob = await blobPromise;
      if (!blob) return false;

      // Try to focus the document before writing
      if (!document.hasFocus()) {
        window.focus();
      }
      
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      return true;
    } catch (fallbackErr) {
      console.error('Clipboard write failed, falling back to download', fallbackErr);
      
      try {
        const blob = await blobPromise;
        if (!blob) return false;
        
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fallbackFilename}_${format(new Date(), 'yyyyMMdd')}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (downloadErr) {
        console.error('Fallback download failed', downloadErr);
      }
      return false;
    }
  }
};

export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (!document.hasFocus()) {
      window.focus();
    }
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Clipboard writeText failed, trying execCommand fallback...', err);
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      // Avoid scrolling to bottom
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.position = "fixed";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);
      return successful;
    } catch (fallbackErr) {
      console.error('Fallback clipboard text write failed', fallbackErr);
      return false;
    }
  }
};
