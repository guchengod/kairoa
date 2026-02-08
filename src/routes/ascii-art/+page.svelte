<script lang="ts">
  import { translationsStore } from '$lib/stores/i18n';
  import { Download, Trash2, Copy, Check, Type, Image as ImageIcon } from 'lucide-svelte';
  import { browser } from '$app/environment';

  let translations = $derived($translationsStore);

  function t(key: string): string {
    const keys = key.split('.');
    let value: any = translations;
    for (const k of keys) {
      value = value?.[k];
    }
    return value || key;
  }

  // ASCII fonts
  const asciiFonts: Record<string, string[]> = {
    standard: [
      "  ###   #####   ####   #####  ###### #######  #####  #     #  ##### ",
      " #   #  #    # #    #  #    # #      #       #     # #     # #     #",
      "#     # #    # #    #  #    # #      #       #       #     # #      ",
      "#     # #####  #    #  #####  #####  #####   #  #### #     #  ##### ",
      "#     # #    # #    #  #  #   #      #       #     # #     #       #",
      " #   #  #    # #    #  #   #  #      #       #     # #     # #     #",
      "  ###   #####   ####   #    # ###### #######  #####   #####   ##### "
    ],
    block: [
      "███████╗██╗   ██╗██████╗  ██████╗ ███████╗██████╗ ",
      "██╔════╝██║   ██║██╔══██╗██╔═══██╗██╔════╝██╔══██╗",
      "█████╗  ██║   ██║██████╔╝██║   ██║█████╗  ██████╔╝",
      "██╔══╝  ██║   ██║██╔══██╗██║   ██║██╔══╝  ██╔══██╗",
      "██║     ╚██████╔╝██║  ██║╚██████╔╝███████╗██║  ██║",
      "╚═╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝"
    ],
    small: [
      "╔═╗┬ ┬┌┬┐┌─┐",
      "╠═╝│ │ │ ├┤ ",
      "╩  └─┘ ┴ └─┘"
    ],
    shadow: [
      "███████╗██╗   ██╗██████╗  ██████╗ ███████╗██████╗ ",
      "██╔════╝██║   ██║██╔══██╗██╔═══██╗██╔════╝██╔══██╗",
      "███████╗██║   ██║██████╔╝██║   ██║█████╗  ██████╔╝",
      "╚════██║██║   ██║██╔══██╗██║   ██║██╔══╝  ██╔══██╗",
      "███████║╚██████╔╝██║  ██║╚██████╔╝███████╗██║  ██║",
      "╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝"
    ],
    banner: [
      " ######  ##     ## ########   #######  ########  ######## ",
      "##    ## ##     ## ##     ## ##     ## ##     ## ##       ",
      "##       ##     ## ##     ## ##     ## ##     ## ##       ",
      " ######  ##     ## ########  ##     ## ########  ######   ",
      "      ## ##     ## ##   ##   ##     ## ##   ##   ##       ",
      "##    ## ##     ## ##    ##  ##     ## ##    ##  ##       ",
      " ######   #######  ##     ##  #######  ##     ## ######## "
    ]
  };

  // Simple character-based ASCII art mapping
  const charMaps: Record<string, string> = {
    standard: ' #',
    block: ' █',
    small: ' ╔╦╗┬├┤└┘═',
    shadow: ' █╔╦╗┬═',
    banner: ' #'
  };

  let input = $state('KAIROA');
  let output = $state('');
  let selectedFont = $state('standard');
  let width = $state(80);
  let copied = $state(false);
  let error = $state('');

  // Text to ASCII conversion
  function generateAsciiArt() {
    if (!input.trim()) {
      error = t('asciiArt.inputRequired');
      output = '';
      return;
    }

    error = '';
    const text = input.toUpperCase();
    
    // Simple letter-based ASCII art
    const letters: Record<string, string[]> = {
      'A': [
        "  ##  ",
        " #  # ",
        "######",
        "#    #",
        "#    #"
      ],
      'B': [
        "##### ",
        "#    #",
        "##### ",
        "#    #",
        "##### "
      ],
      'C': [
        " #####",
        "#     ",
        "#     ",
        "#     ",
        " #####"
      ],
      'D': [
        "##### ",
        "#    #",
        "#    #",
        "#    #",
        "##### "
      ],
      'E': [
        "######",
        "#     ",
        "##### ",
        "#     ",
        "######"
      ],
      'F': [
        "######",
        "#     ",
        "##### ",
        "#     ",
        "#     "
      ],
      'G': [
        " #####",
        "#     ",
        "#  ###",
        "#    #",
        " #####"
      ],
      'H': [
        "#    #",
        "#    #",
        "######",
        "#    #",
        "#    #"
      ],
      'I': [
        "######",
        "  ##  ",
        "  ##  ",
        "  ##  ",
        "######"
      ],
      'J': [
        "     #",
        "     #",
        "     #",
        "#    #",
        " #### "
      ],
      'K': [
        "#    #",
        "#   # ",
        "####  ",
        "#   # ",
        "#    #"
      ],
      'L': [
        "#     ",
        "#     ",
        "#     ",
        "#     ",
        "######"
      ],
      'M': [
        "#    #",
        "##  ##",
        "# ## #",
        "#    #",
        "#    #"
      ],
      'N': [
        "#    #",
        "##   #",
        "# #  #",
        "#  # #",
        "#   ##"
      ],
      'O': [
        " #### ",
        "#    #",
        "#    #",
        "#    #",
        " #### "
      ],
      'P': [
        "##### ",
        "#    #",
        "##### ",
        "#     ",
        "#     "
      ],
      'Q': [
        " #### ",
        "#    #",
        "#    #",
        "#  # #",
        " #### "
      ],
      'R': [
        "##### ",
        "#    #",
        "##### ",
        "#   # ",
        "#    #"
      ],
      'S': [
        " #####",
        "#     ",
        " #### ",
        "     #",
        "##### "
      ],
      'T': [
        "######",
        "  ##  ",
        "  ##  ",
        "  ##  ",
        "  ##  "
      ],
      'U': [
        "#    #",
        "#    #",
        "#    #",
        "#    #",
        " #### "
      ],
      'V': [
        "#    #",
        "#    #",
        "#    #",
        " #  # ",
        "  ##  "
      ],
      'W': [
        "#    #",
        "#    #",
        "# ## #",
        "##  ##",
        "#    #"
      ],
      'X': [
        "#    #",
        " #  # ",
        "  ##  ",
        " #  # ",
        "#    #"
      ],
      'Y': [
        "#    #",
        " #  # ",
        "  ##  ",
        "  ##  ",
        "  ##  "
      ],
      'Z': [
        "######",
        "    # ",
        "   #  ",
        "  #   ",
        "######"
      ],
      '0': [
        " #### ",
        "#   ##",
        "#  # #",
        "##   #",
        " #### "
      ],
      '1': [
        "  #   ",
        " ##   ",
        "  #   ",
        "  #   ",
        " ###  "
      ],
      '2': [
        " #### ",
        "     #",
        " #### ",
        "#     ",
        "######"
      ],
      '3': [
        " #### ",
        "     #",
        " #### ",
        "     #",
        " #### "
      ],
      '4': [
        "#    #",
        "#    #",
        "######",
        "     #",
        "     #"
      ],
      '5': [
        "######",
        "#     ",
        " #### ",
        "     #",
        " #### "
      ],
      '6': [
        " #### ",
        "#     ",
        "##### ",
        "#    #",
        " #### "
      ],
      '7': [
        "######",
        "    # ",
        "   #  ",
        "  #   ",
        " #    "
      ],
      '8': [
        " #### ",
        "#    #",
        " #### ",
        "#    #",
        " #### "
      ],
      '9': [
        " #### ",
        "#    #",
        " #####",
        "     #",
        " #### "
      ],
      ' ': [
        "      ",
        "      ",
        "      ",
        "      ",
        "      "
      ],
      '-': [
        "      ",
        "      ",
        "######",
        "      ",
        "      "
      ],
      '_': [
        "      ",
        "      ",
        "      ",
        "      ",
        "######"
      ],
      '.': [
        "      ",
        "      ",
        "      ",
        "      ",
        "  ##  "
      ],
      '!': [
        "  #   ",
        "  #   ",
        "  #   ",
        "      ",
        "  #   "
      ],
      '?': [
        " #### ",
        "#    #",
        "   ## ",
        "      ",
        "  #   "
      ]
    };

    // Generate ASCII art
    const lines: string[] = ['', '', '', '', ''];
    
    for (const char of text) {
      const pattern = letters[char] || letters['?'];
      for (let i = 0; i < 5; i++) {
        lines[i] += pattern[i] + ' ';
      }
    }

    output = lines.join('\n');
  }

  // Image to ASCII conversion
  let canvas: HTMLCanvasElement | null = $state(null);
  let imageFile: File | null = $state(null);
  let imagePreview: string = $state('');
  let isProcessingImage = $state(false);
  let imageAsciiOutput = $state('');
  let imageWidth = $state(100);
  let brightnessChars = $state(' .:-=+*#%@');
  let activeTab = $state<'text' | 'image'>('text');

  function handleImageSelect(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files[0]) {
      imageFile = target.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        imagePreview = e.target?.result as string;
      };
      reader.readAsDataURL(imageFile);
    }
  }

  function convertImageToAscii() {
    if (!imagePreview || !canvas) return;
    
    isProcessingImage = true;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Calculate dimensions maintaining aspect ratio
      const aspectRatio = img.height / img.width;
      const targetWidth = Math.min(imageWidth, 200);
      const targetHeight = Math.floor(targetWidth * aspectRatio * 0.5); // 0.5 for character aspect ratio

      canvas!.width = targetWidth;
      canvas!.height = targetHeight;

      // Draw image
      ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

      // Get pixel data
      const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imageData.data;

      // Convert to ASCII
      let ascii = '';
      for (let y = 0; y < targetHeight; y++) {
        for (let x = 0; x < targetWidth; x++) {
          const offset = (y * targetWidth + x) * 4;
          const r = data[offset];
          const g = data[offset + 1];
          const b = data[offset + 2];
          
          // Calculate brightness
          const brightness = (r + g + b) / 3;
          const charIndex = Math.floor((brightness / 255) * (brightnessChars.length - 1));
          ascii += brightnessChars[charIndex];
        }
        ascii += '\n';
      }

      imageAsciiOutput = ascii;
      isProcessingImage = false;
    };
    img.src = imagePreview;
  }

  function clearImage() {
    imageFile = null;
    imagePreview = '';
    imageAsciiOutput = '';
  }

  function copyToClipboard(text: string) {
    if (browser) {
      navigator.clipboard.writeText(text).then(() => {
        copied = true;
        setTimeout(() => copied = false, 2000);
      });
    }
  }

  function downloadAscii(text: string, filename: string) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Auto-generate on input change
  $effect(() => {
    if (input && activeTab === 'text') {
      generateAsciiArt();
    }
  });
</script>

<div class="flex flex-col h-full w-full ml-0 mr-0 p-2">
  <div class="flex-1 flex flex-col space-y-6 min-h-0">
    <!-- Tab Navigation -->
    <div class="flex gap-2 border-b border-gray-200 dark:border-gray-700">
      <button
        class="px-4 py-2 font-medium text-sm transition-colors border-b-2 {activeTab === 'text' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
        onclick={() => activeTab = 'text'}
      >
        <Type class="w-4 h-4 inline mr-2" />
        {t('asciiArt.textTab')}
      </button>
      <button
        class="px-4 py-2 font-medium text-sm transition-colors border-b-2 {activeTab === 'image' ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'}"
        onclick={() => activeTab = 'image'}
      >
        <ImageIcon class="w-4 h-4 inline mr-2" />
        {t('asciiArt.imageTab')}
      </button>
    </div>

    {#if activeTab === 'text'}
      <!-- Text to ASCII -->
      <div class="card flex-shrink-0">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('asciiArt.input')}
            </label>
            <input
              type="text"
              bind:value={input}
              placeholder={t('asciiArt.inputPlaceholder')}
              class="input w-full"
              maxlength="20"
            />
          </div>

          <div class="flex gap-4">
            <div class="flex-1">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('asciiArt.width')}
              </label>
              <input
                type="range"
                bind:value={width}
                min="40"
                max="200"
                step="10"
                class="w-full"
              />
              <span class="text-xs text-gray-500 dark:text-gray-400">{width}</span>
            </div>
          </div>

          <div class="flex gap-2">
            <button onclick={() => generateAsciiArt()} class="btn-primary">
              {t('asciiArt.generate')}
            </button>
            <button onclick={() => { input = ''; output = ''; }} class="btn-secondary">
              <Trash2 class="w-4 h-4 inline mr-1" />
              {t('asciiArt.clear')}
            </button>
          </div>
        </div>
      </div>

      <!-- Output -->
      {#if output}
        <div class="card flex-1 min-h-0">
          <div class="space-y-4 h-full flex flex-col">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                {t('asciiArt.output')}
              </h3>
              <div class="flex gap-2">
                <button
                  onclick={() => copyToClipboard(output)}
                  class="btn-secondary flex items-center gap-2"
                >
                  {#if copied}
                    <Check class="w-4 h-4" />
                    {t('asciiArt.copied')}
                  {:else}
                    <Copy class="w-4 h-4" />
                    {t('asciiArt.copy')}
                  {/if}
                </button>
                <button
                  onclick={() => downloadAscii(output, 'ascii-art.txt')}
                  class="btn-secondary flex items-center gap-2"
                >
                  <Download class="w-4 h-4" />
                  {t('asciiArt.download')}
                </button>
              </div>
            </div>
            
            <div class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <pre class="font-mono text-sm text-gray-800 dark:text-gray-200 whitespace-pre">{output}</pre>
            </div>
          </div>
        </div>
      {/if}

      {#if error}
        <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      {/if}
    {:else}
      <!-- Image to ASCII -->
      <div class="card flex-shrink-0">
        <div class="space-y-4">
          {#if !imagePreview}
            <div class="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
              <input
                type="file"
                accept="image/*"
                onchange={handleImageSelect}
                class="hidden"
                id="image-upload"
              />
              <label
                for="image-upload"
                class="cursor-pointer flex flex-col items-center gap-2"
              >
                <ImageIcon class="w-12 h-12 text-gray-400" />
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  {t('asciiArt.dragDropImage')}
                </span>
                <span class="text-xs text-gray-500 dark:text-gray-500">
                  {t('asciiArt.supportedFormats')}
                </span>
              </label>
            </div>
          {:else}
            <div class="space-y-4">
              <div class="flex items-center gap-4">
                <img src={imagePreview} alt="Preview" class="h-32 object-contain rounded-lg border border-gray-200 dark:border-gray-700" />
                <button onclick={clearImage} class="btn-secondary">
                  <Trash2 class="w-4 h-4 inline mr-1" />
                  {t('asciiArt.removeImage')}
                </button>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('asciiArt.imageWidth')}
                </label>
                <input
                  type="range"
                  bind:value={imageWidth}
                  min="50"
                  max="200"
                  step="10"
                  class="w-full"
                />
                <span class="text-xs text-gray-500 dark:text-gray-400">{imageWidth} chars</span>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('asciiArt.brightnessChars')}
                </label>
                <input
                  type="text"
                  bind:value={brightnessChars}
                  class="input w-full font-mono"
                  placeholder=" .:-=+*#%@"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('asciiArt.brightnessCharsHint')}
                </p>
              </div>

              <button
                onclick={convertImageToAscii}
                class="btn-primary"
                disabled={isProcessingImage}
              >
                {#if isProcessingImage}
                  {t('asciiArt.converting')}
                {:else}
                  {t('asciiArt.convert')}
                {/if}
              </button>
            </div>
          {/if}
        </div>
      </div>

      <!-- Image ASCII Output -->
      {#if imageAsciiOutput}
        <div class="card flex-1 min-h-0">
          <div class="space-y-4 h-full flex flex-col">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100">
                {t('asciiArt.output')}
              </h3>
              <div class="flex gap-2">
                <button
                  onclick={() => copyToClipboard(imageAsciiOutput)}
                  class="btn-secondary flex items-center gap-2"
                >
                  {#if copied}
                    <Check class="w-4 h-4" />
                    {t('asciiArt.copied')}
                  {:else}
                    <Copy class="w-4 h-4" />
                    {t('asciiArt.copy')}
                  {/if}
                </button>
                <button
                  onclick={() => downloadAscii(imageAsciiOutput, 'image-ascii.txt')}
                  class="btn-secondary flex items-center gap-2"
                >
                  <Download class="w-4 h-4" />
                  {t('asciiArt.download')}
                </button>
              </div>
            </div>
            
            <div class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
              <pre class="font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre leading-none">{imageAsciiOutput}</pre>
            </div>
          </div>
        </div>
      {/if}
    {/if}
  </div>
</div>

<canvas bind:this={canvas} class="hidden"></canvas>
