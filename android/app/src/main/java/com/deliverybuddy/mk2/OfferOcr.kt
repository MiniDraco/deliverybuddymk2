package com.deliverybuddy.mk2

import android.content.Context
import android.net.Uri
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions

/**
 * On-device OCR for offer screenshots, using ML Kit's bundled Latin text
 * recognizer — runs fully offline (no Tesseract CDN, no network). Replaces the
 * PWA's broken cross-origin Tesseract path that was never cached by the SW.
 */
object OfferOcr {

    /** Recognize text from an image [uri]; calls [onText] with the raw OCR text. */
    fun scan(ctx: Context, uri: Uri, onText: (String) -> Unit, onError: (Exception) -> Unit) {
        try {
            val image = InputImage.fromFilePath(ctx, uri)
            val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
            recognizer.process(image)
                .addOnSuccessListener { result -> onText(result.text) }
                .addOnFailureListener { e -> onError(e) }
        } catch (e: Exception) {
            onError(e)
        }
    }
}
