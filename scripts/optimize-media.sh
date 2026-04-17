#!/bin/bash
# J7 Creations - Media Optimization Script
# Strips metadata and resizes images/videos for web

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ASSETS_DIR="$PROJECT_ROOT/assets"

echo "🔧 J7 Creations - Media Optimization"
echo "===================================="
echo ""

# Check for required tools
check_tools() {
    local missing=0
    
    if ! command -v exiftool &> /dev/null; then
        echo "❌ exiftool not found. Install with:"
        echo "   Linux: sudo apt install libimage-exiftool-perl"
        echo "   macOS: brew install exiftool"
        echo "   Windows: https://exiftool.org/"
        missing=1
    else
        echo "✅ exiftool found"
    fi
    
    if ! command -v ffmpeg &> /dev/null; then
        echo "⚠️  ffmpeg not found (optional, for video optimization)"
        echo "   Install with: sudo apt install ffmpeg OR brew install ffmpeg"
    else
        echo "✅ ffmpeg found"
    fi
    
    if ! command -v convert &> /dev/null; then
        echo "⚠️  ImageMagick not found (optional, for image resizing)"
        echo "   Install with: sudo apt install imagemagick OR brew install imagemagick"
    else
        echo "✅ ImageMagick found"
    fi
    
    if [ $missing -eq 1 ]; then
        echo ""
        echo "Please install missing tools and run again."
        exit 1
    fi
    
    echo ""
}

# Strip metadata from images
strip_image_metadata() {
    echo "📸 Stripping image metadata..."
    
    find "$ASSETS_DIR" -type f \( -name "*.jpg" -o -name "*.jpeg" -o -name "*.png" -o -name "*.gif" -o -name "*.webp" \) | while read -r file; do
        echo "   Processing: $(basename "$file")"
        exiftool -overwrite_original -all= "$file"
    done
    
    echo "✅ Image metadata stripped"
    echo ""
}

# Resize images to web-friendly sizes
resize_images() {
    echo "📐 Resizing images for web..."
    
    # Portfolio images - max 1920px wide (Full HD)
    find "$ASSETS_DIR/portfolio" -type f \( -name "*.jpg" -o -name "*.jpeg" \) | while read -r file; do
        echo "   Resizing: $(basename "$file")"
        
        # Get current dimensions
        width=$(exiftool -s -s -s -ImageWidth "$file")
        
        if [ "$width" -gt 1920 ]; then
            echo "      Current: ${width}px → Resizing to 1920px"
            convert "$file" -resize '1920x>' -quality 85 "$file"
        else
            echo "      Already web-sized: ${width}px"
        fi
    done
    
    # Logo - keep small
    if [ -f "$ASSETS_DIR/j7-logo.png" ]; then
        width=$(exiftool -s -s -s -ImageWidth "$ASSETS_DIR/j7-logo.png")
        if [ "$width" -gt 400 ]; then
            echo "   Resizing logo to 400px"
            convert "$ASSETS_DIR/j7-logo.png" -resize '400x>' "$ASSETS_DIR/j7-logo.png"
        fi
    fi
    
    echo "✅ Images resized"
    echo ""
}

# Strip video metadata
strip_video_metadata() {
    if ! command -v ffmpeg &> /dev/null; then
        echo "⊘ Skipping video optimization (ffmpeg not installed)"
        echo ""
        return
    fi
    
    echo "🎬 Stripping video metadata..."
    
    find "$ASSETS_DIR" -type f -name "*.mp4" | while read -r file; do
        echo "   Processing: $(basename "$file")"
        
        # Create temp file
        temp_file="${file%.mp4}.temp.mp4"
        
        # Re-encode without metadata (copy streams to avoid quality loss)
        ffmpeg -i "$file" -c copy -map_metadata -1 -y "$temp_file" 2>/dev/null
        
        # Replace original
        mv "$temp_file" "$file"
        
        echo "      Metadata stripped"
    done
    
    echo "✅ Video metadata stripped"
    echo ""
}

# Create backup
create_backup() {
    echo "💾 Creating backup..."
    
    BACKUP_DIR="$PROJECT_ROOT/assets-backup-$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    cp -r "$ASSETS_DIR" "$BACKUP_DIR/"
    
    echo "✅ Backup created: $BACKUP_DIR"
    echo ""
}

# Main execution
main() {
    cd "$PROJECT_ROOT"
    
    echo "Project root: $PROJECT_ROOT"
    echo "Assets directory: $ASSETS_DIR"
    echo ""
    
    check_tools
    
    echo "This will:"
    echo "  1. Strip all EXIF/metadata from images"
    echo "  2. Resize large images to web-friendly sizes (max 1920px)"
    echo "  3. Strip metadata from videos"
    echo "  4. Create a backup of original files"
    echo ""
    read -p "Continue? (y/n) " -n 1 -r
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cancelled."
        exit 0
    fi
    
    create_backup
    strip_image_metadata
    resize_images
    strip_video_metadata
    
    echo "===================================="
    echo "✅ Optimization complete!"
    echo ""
    echo "Next steps:"
    echo "  1. Review the changes"
    echo "  2. Test your site locally"
    echo "  3. Commit and push if everything looks good"
    echo "  4. Delete backup folder when confident: rm -rf assets-backup-*"
}

main
