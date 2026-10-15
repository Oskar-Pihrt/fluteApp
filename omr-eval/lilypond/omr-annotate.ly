% Included before every score (lilypond -dinclude-settings=omr-annotate.ly).
%
% Tags grobs in the SVG output with a class, and noteheads additionally with
% their pitch, so a LilyPond-engraved page comes with exact ground truth:
% where every symbol sits and what every notehead is. Used for the eval set
% and as a second engraver for training data.

#(define (omr-class name)
   (lambda (grob) `((class . ,(string-append "omr-" name)))))

#(define (omr-notehead grob)
   (let* ((cause (event-cause grob))
          (pitch (and cause (ly:event-property cause 'pitch #f)))
          (grace (not (= 0 (ly:moment-grace (grob::when grob)))))
          (tied (assq-ref (ly:grob-property grob 'details '()) 'omr-tied))
          (duration (and cause (ly:event-property cause 'duration #f)))
          (log (if duration (ly:duration-log duration) 2)))
     (if pitch
         `((class . "omr-notehead")
           (data-midi . ,(number->string (+ 60 (ly:pitch-semitones pitch))))
           (data-step . ,(number->string (+ (ly:pitch-notename pitch) (* 7 (ly:pitch-octave pitch)))))
           (data-alt . ,(number->string (ly:pitch-alteration pitch)))
           (data-log . ,(number->string log))
           (data-grace . ,(if grace "1" "0"))
           (data-tied . ,(if tied "1" "0")))
         '((class . "omr-notehead-other")))))

#(define (omr-mark-tie grob)
   (let ((right (ly:spanner-bound grob RIGHT)))
     (if (and (ly:grob? right) (grob::has-interface right 'note-head-interface))
         (ly:grob-set-property! right 'details
           (acons 'omr-tied #t (ly:grob-property right 'details '()))))))

#(define (omr-keysig grob)
   (let* ((alist (ly:grob-property grob 'alteration-alist '()))
          (first (if (pair? alist) (cdar alist) 0))
          (alt (if (pair? first) (cdr first) first)))
     `((class . "omr-keysig")
       (data-kind . ,(if (< alt 0) "flat" "sharp")))))

#(define (omr-accidental grob)
   `((class . "omr-accidental")
     (data-alt . ,(number->string (ly:grob-property grob 'alteration 0)))))

\layout {
  \context {
    \Score
    \override NoteHead.output-attributes = #omr-notehead
    \override Tie.before-line-breaking = #omr-mark-tie
    \override Accidental.output-attributes = #omr-accidental
    \override AccidentalCautionary.output-attributes = #omr-accidental
    \override StaffSymbol.output-attributes = #(omr-class "staff")
    \override Clef.output-attributes = #(omr-class "clef")
    \override KeySignature.output-attributes = #omr-keysig
    \override KeyCancellation.output-attributes = #(omr-class "keycancel")
    \override TimeSignature.output-attributes = #(omr-class "timesig")
    \override BarLine.output-attributes = #(omr-class "barline")
    \override Rest.output-attributes = #(omr-class "rest")
    \override MultiMeasureRest.output-attributes = #(omr-class "rest")
    \override OttavaBracket.output-attributes = #(omr-class "ottava")
    \override Beam.output-attributes = #(omr-class "beam")
    \override Stem.output-attributes = #(omr-class "stem")
    \override Flag.output-attributes = #(omr-class "flag")
    \override Dots.output-attributes = #(omr-class "dots")
    \override Slur.output-attributes = #(omr-class "slur")
    \override Tie.output-attributes = #(omr-class "tie")
    \override Script.output-attributes = #(omr-class "script")
    \override TextScript.output-attributes = #(omr-class "text")
    \override DynamicText.output-attributes = #(omr-class "dynamic")
    \override Fingering.output-attributes = #(omr-class "fingering")
    \override LedgerLineSpanner.output-attributes = #(omr-class "ledger")
  }
}
