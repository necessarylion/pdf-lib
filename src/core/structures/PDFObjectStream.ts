import PDFName from 'src/core/objects/PDFName';
import PDFNumber from 'src/core/objects/PDFNumber';
import PDFObject from 'src/core/objects/PDFObject';
import PDFRef from 'src/core/objects/PDFRef';
import PDFStream from 'src/core/objects/PDFStream';
import PDFContext from 'src/core/PDFContext';
import CharCodes from 'src/core/syntax/CharCodes';
import { copyStringIntoBuffer, last } from 'src/utils';

export type IndirectObject = [PDFRef, PDFObject];

class PDFObjectStream extends PDFStream {
  static withContextAndObjects = (
    context: PDFContext,
    objects: IndirectObject[],
  ) => new PDFObjectStream(context, objects);

  private readonly objects: IndirectObject[];
  private readonly offsets: Array<[number, number]>;
  private readonly offsetsString: string;

  private constructor(context: PDFContext, objects: IndirectObject[]) {
    super(context.obj({}));

    this.objects = objects;
    this.offsets = this.computeObjectOffsets();
    this.offsetsString = this.computeOffsetsString();

    this.dict.set(PDFName.of('Type'), PDFName.of('ObjStm'));
    this.dict.set(PDFName.of('N'), PDFNumber.of(this.objects.length));
    this.dict.set(PDFName.of('First'), PDFNumber.of(this.offsetsString.length));
  }

  clone(context?: PDFContext): PDFObjectStream {
    return PDFObjectStream.withContextAndObjects(
      context || this.dict.context,
      this.objects.slice(),
    );
  }

  getContentsString(): string {
    let value = this.offsetsString;
    for (let idx = 0, len = this.objects.length; idx < len; idx++) {
      const [, object] = this.objects[idx];
      value += `\n${object}`;
    }
    return value;
  }

  getContents(): Uint8Array {
    const buffer = new Uint8Array(this.getContentsSize());
    let offset = copyStringIntoBuffer(this.offsetsString, buffer, 0);
    for (let idx = 0, len = this.objects.length; idx < len; idx++) {
      const [, object] = this.objects[idx];
      buffer[offset++] = CharCodes.Newline;
      offset += object.copyBytesInto(buffer, offset);
    }
    return buffer;
  }

  getContentsSize(): number {
    return (
      this.offsetsString.length +
      last(this.offsets)[1] +
      last(this.objects)[1].sizeInBytes() +
      1
    );
  }

  private computeOffsetsString(): string {
    let offsetsString = '';
    for (let idx = 0, len = this.offsets.length; idx < len; idx++) {
      const [objectNumber, offset] = this.offsets[idx];
      offsetsString += `${objectNumber} ${offset} `;
    }
    return offsetsString;
  }

  private computeObjectOffsets(): Array<[number, number]> {
    let offset = 0;
    const offsets = new Array(this.objects.length);
    for (let idx = 0, len = this.objects.length; idx < len; idx++) {
      const [ref, object] = this.objects[idx];
      offsets[idx] = [ref.objectNumber, offset];
      offset += object.sizeInBytes() + 1; // '\n'
    }
    return offsets;
  }
}

export default PDFObjectStream;