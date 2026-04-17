import { useEffect, useMemo, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import type { InterviewQuestionCard } from '@/lib/contracts';
import { Button } from '@/components/ui/Button';

function normalizeTextList(raw: string) {
  return raw
    .split('\n')
    .map((value) => value.trim())
    .filter(Boolean);
}

export function QuestionComposer({
  card,
  disabled,
  isSubmitting,
  onSubmit,
}: {
  card: InterviewQuestionCard;
  disabled?: boolean;
  isSubmitting?: boolean;
  onSubmit: (value: string | number | string[]) => Promise<void> | void;
}) {
  const [textValue, setTextValue] = useState('');
  const [sliderValue, setSliderValue] = useState(card.min || 3);
  const [selected, setSelected] = useState<string[]>([]);
  const [customOption, setCustomOption] = useState('');

  useEffect(() => {
    setTextValue('');
    setSliderValue(card.min || 3);
    setSelected([]);
    setCustomOption('');
  }, [card]);

  const optionMap = useMemo(
    () =>
      new Map(
        card.options.map((option) => [
          option.id,
          {
            label: option.label,
            hint: option.hint,
          },
        ]),
      ),
    [card.options],
  );

  const hasReachedSelectionCap =
    card.kind !== 'single_select' && typeof card.maxSelections === 'number' && selected.length >= card.maxSelections;
  const canAddCustomOption = card.id === 'task-selection' && card.kind !== 'single_select';

  function toggleSelection(id: string) {
    setSelected((current) => {
      if (card.kind === 'single_select') {
        return current[0] === id ? [] : [id];
      }
      if (current.includes(id)) {
        return current.filter((value) => value !== id);
      }
      if (card.maxSelections && current.length >= card.maxSelections) {
        return current;
      }
      return [...current, id];
    });
  }

  function addCustomOption() {
    const value = customOption.trim();
    if (!value) return;
    setSelected((current) => {
      if (current.includes(value)) return current;
      if (card.kind !== 'single_select' && card.maxSelections && current.length >= card.maxSelections) {
        return current;
      }
      return [...current, value];
    });
    setCustomOption('');
  }

  async function handleSubmit() {
    if (card.kind === 'text') {
      await onSubmit(textValue.trim());
      return;
    }

    if (card.kind === 'slider') {
      await onSubmit(sliderValue);
      return;
    }

    await onSubmit(card.kind === 'single_select' ? selected[0] || '' : selected);
  }

  const canSubmit =
    disabled ||
    (card.kind === 'text'
      ? textValue.trim().length === 0
      : card.kind === 'slider'
        ? false
        : selected.length === 0);

  return (
    <div className="question-panel">
      <div className="stack" style={{ gap: 10 }}>
        <h2 className="question-title">{card.title}</h2>
        {card.description ? <p className="question-description">{card.description}</p> : null}
        {card.kind === 'multi_select' && card.maxSelections ? (
          <p className="helper-text">Select up to {card.maxSelections} options.</p>
        ) : null}
      </div>

      {card.kind === 'text' ? (
        <div className="field">
          <textarea
            value={textValue}
            placeholder={card.placeholder}
            onChange={(event) => setTextValue(event.target.value)}
            disabled={disabled}
          />
        </div>
      ) : null}

      {card.kind === 'slider' ? (
        <div className="slider-wrap">
          <div className="slider-value">{sliderValue}</div>
          <input
            type="range"
            min={card.min || 1}
            max={card.max || 5}
            step={card.step || 1}
            value={sliderValue}
            onChange={(event) => setSliderValue(Number(event.target.value))}
            disabled={disabled}
          />
          <div className="progress-row">
            <span>Mild annoyance</span>
            <span>Weekly drain</span>
          </div>
        </div>
      ) : null}

      {card.kind === 'single_select' || card.kind === 'multi_select' || card.kind === 'chips' ? (
        <div className="stack" style={{ gap: 16 }}>
          <div className="option-grid">
            {card.options.map((option) => (
              <button
                key={option.id}
                type="button"
                className="option-card"
                data-selected={selected.includes(option.id)}
                onClick={() => toggleSelection(option.id)}
                disabled={disabled}
              >
                <span className="option-label">{option.label}</span>
                {option.hint ? <p className="option-hint">{option.hint}</p> : null}
              </button>
            ))}
            {selected
              .filter((value) => !optionMap.has(value))
              .map((value) => (
                <button
                  key={value}
                  type="button"
                  className="option-card"
                  data-selected="true"
                  onClick={() => toggleSelection(value)}
                  disabled={disabled}
                >
                  <span className="option-label">{value}</span>
                  <p className="option-hint">Custom workflow</p>
                </button>
              ))}
          </div>

          {canAddCustomOption && !hasReachedSelectionCap ? (
            <div className="field-grid" style={{ gridTemplateColumns: '1fr auto' }}>
              <div className="field">
                <label htmlFor="custom-option">Add a workflow that is missing</label>
                <input
                  id="custom-option"
                  value={customOption}
                  placeholder="Example: QBR prep"
                  onChange={(event) => setCustomOption(event.target.value)}
                  disabled={disabled}
                />
              </div>
              <div style={{ alignSelf: 'end' }}>
                <Button type="button" onClick={addCustomOption} disabled={disabled || customOption.trim().length === 0}>
                  Add
                </Button>
              </div>
            </div>
          ) : null}
          {canAddCustomOption && hasReachedSelectionCap ? (
            <p className="helper-text">You have reached the selection limit for this question. Deselect one to add another.</p>
          ) : null}
        </div>
      ) : null}

      <div className="button-row">
        <Button onClick={handleSubmit} disabled={canSubmit}>
          {isSubmitting ? (
            <>
              <LoaderCircle size={16} className="button-spinner" />
              Thinking...
            </>
          ) : (
            'Save answer'
          )}
        </Button>
        {isSubmitting ? <span className="status-line">Shaping the next question...</span> : null}
        {!isSubmitting && card.kind === 'text' && normalizeTextList(textValue).length > 1 ? (
          <span className="status-line">{normalizeTextList(textValue).length} points drafted</span>
        ) : null}
      </div>
    </div>
  );
}
