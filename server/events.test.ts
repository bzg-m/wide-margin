import { describe, expect, it } from 'vitest';
import { EventName, type Annotation, type ReadingEvent } from '../shared/api.ts';
import { ReadingEvents } from './events.ts';

const eventFor = (id: string): ReadingEvent => ({
  name: EventName.AnnotationCreated,
  data: { id } as Annotation,
});

describe('ReadingEvents', () => {
  it('stops delivering to a listener once it unsubscribes', () => {
    const events = new ReadingEvents();
    const received: string[] = [];
    const unsubscribe = events.subscribe('1', (event) => received.push(event.data.id));

    events.publish('1', eventFor('before'));
    unsubscribe();
    events.publish('1', eventFor('after'));

    expect(received).toEqual(['before']);
  });
});
